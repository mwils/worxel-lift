import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { HydratedDocument } from "mongoose";
import { User, type UserDoc, VerifyAuthDto } from "@lift/shared";
import { hashMagicToken, hashSmsCode, signSessionCookie } from "../../lib/auth.js";
import { handleKnownErrors, parseBody, withErrorBoundary } from "../../lib/middleware.js";
import { badRequest, ok, unauthorized } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const dto = await parseBody(event, VerifyAuthDto);

    let user: HydratedDocument<UserDoc> | null = null;

    if (dto.token && dto.email) {
      const hash = hashMagicToken(dto.token);
      user = await User.findOne({
        email: dto.email.toLowerCase().trim(),
        "auth.magicLinkHash": hash,
        "auth.magicLinkExpiresAt": { $gt: new Date() },
      });
      if (!user) return unauthorized("Invalid or expired link");
      user.set("auth.magicLinkHash", undefined);
      user.set("auth.magicLinkExpiresAt", undefined);
      // Completing the email round-trip proves ownership — unlocks the
      // outbound-send routes gated by withVerifiedAuth.
      user.set("emailVerified", true);
    } else if (dto.phone && dto.code) {
      const hash = hashSmsCode(dto.code);
      user = await User.findOne({
        phone: dto.phone,
        "auth.smsCode": hash,
        "auth.smsCodeExpiresAt": { $gt: new Date() },
      });
      if (!user) return unauthorized("Invalid or expired code");
      user.set("auth.smsCode", undefined);
      user.set("auth.smsCodeExpiresAt", undefined);
    } else {
      return badRequest("Provide either {token, email} or {phone, code}");
    }

    user.set("auth.lastLoginAt", new Date());
    await user.save();

    const cookie = await signSessionCookie({
      userId: user._id.toString(),
      shopId: user.shopId?.toString(),
      email: user.email,
      role: (user.role as "owner" | "tech") ?? "owner",
    });

    return ok(
      { ok: true, needsOnboarding: !user.shopId },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
