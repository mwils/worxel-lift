import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Handler,
} from "aws-lambda";
import { z, ZodError, type ZodTypeAny } from "zod";
import { connectDb } from "@lift/shared/db";
import { User } from "@lift/shared";
import { verifySessionCookie, type SessionClaims } from "./auth.js";
import { badRequest, forbidden, serverError, unauthorized } from "./response.js";

export interface RequestContext {
  event: APIGatewayProxyEventV2;
  user: SessionClaims;
}

export type Handlerish = (
  ctx: RequestContext
) => Promise<APIGatewayProxyStructuredResultV2> | APIGatewayProxyStructuredResultV2;

/** Top-level error boundary + DB connection. */
export function withErrorBoundary<E extends APIGatewayProxyEventV2 = APIGatewayProxyEventV2>(
  inner: (event: E) => Promise<APIGatewayProxyStructuredResultV2>
): Handler<E, APIGatewayProxyStructuredResultV2> {
  return async (event) => {
    try {
      await connectDb();
      return await inner(event);
    } catch (err) {
      console.error("[handler] unhandled", err);
      const message = err instanceof Error ? err.message : "Internal error";
      return serverError(message);
    }
  };
}

/** Require an authenticated session cookie. */
export function withAuth(handler: Handlerish): Handler<APIGatewayProxyEventV2> {
  return withErrorBoundary(async (event) => {
    const cookieHeader = event.cookies?.join("; ") ?? event.headers?.cookie ?? "";
    const session = await verifySessionCookie(cookieHeader);
    if (!session) return unauthorized();
    return handler({ event, user: session });
  });
}

/**
 * Require auth + a confirmed email. Instant-signup accounts get a session
 * before proving they own the address, so anything that reaches a customer
 * (SMS/email sends, pay links) goes through this instead of withAuth.
 * Checked against the DB, not the JWT — verification can happen on another
 * device after this session's cookie was minted.
 */
export function withVerifiedAuth(handler: Handlerish): Handler<APIGatewayProxyEventV2> {
  return withAuth(async (ctx) => {
    const u = await User.findById(ctx.user.userId).select("emailVerified").lean();
    if (u?.emailVerified === false) {
      return forbidden(
        `Confirm your email first — we sent a link to ${ctx.user.email}. You can resend it from the banner in the app.`
      );
    }
    return handler(ctx);
  });
}

/** Parse + validate a JSON body against a Zod schema. */
export async function parseBody<S extends ZodTypeAny>(
  event: APIGatewayProxyEventV2,
  schema: S
): Promise<z.infer<S>> {
  if (!event.body) throw new ValidationError("Request body required");
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body
    );
  } catch {
    throw new ValidationError("Invalid JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new ValidationError("Validation failed", result.error);
  return result.data;
}

/** Parse + validate query string params against a Zod schema. */
export function parseQuery<S extends ZodTypeAny>(
  event: APIGatewayProxyEventV2,
  schema: S
): z.infer<S> {
  const result = schema.safeParse(event.queryStringParameters ?? {});
  if (!result.success) throw new ValidationError("Invalid query", result.error);
  return result.data;
}

export class ValidationError extends Error {
  details?: ZodError;
  constructor(message: string, details?: ZodError) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

/** Map known errors to clean 400 responses. */
export function handleKnownErrors(err: unknown): APIGatewayProxyStructuredResultV2 | null {
  if (err instanceof ValidationError) {
    return badRequest(err.message, err.details?.flatten());
  }
  return null;
}
