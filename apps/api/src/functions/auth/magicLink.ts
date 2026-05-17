import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RequestMagicLinkDto, User } from "@lift/shared";
import { MAGIC_LINK_TTL_MIN } from "@lift/shared/constants";
import { generateMagicToken } from "../../lib/auth.js";
import { parseBody, withErrorBoundary, handleKnownErrors } from "../../lib/middleware.js";
import { sendEmail } from "../../lib/ses.js";
import { badRequest, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const { email } = await parseBody(event, RequestMagicLinkDto);
    const normalized = email.toLowerCase().trim();

    const { token, hash } = generateMagicToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);

    await User.updateOne(
      { email: normalized },
      {
        $setOnInsert: { email: normalized, role: "owner" },
        $set: { "auth.magicLinkHash": hash, "auth.magicLinkExpiresAt": expiresAt },
      },
      { upsert: true }
    );

    const verifyUrl = `${process.env.WEB_APP_URL ?? ""}/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalized)}`;

    await sendEmail({
      to: normalized,
      subject: "Your Lift sign-in link",
      text: `Tap the link below to sign in. It expires in ${MAGIC_LINK_TTL_MIN} minutes.\n\n${verifyUrl}\n\nIf you didn't request this, ignore this email.`,
    });

    return ok({ ok: true });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
