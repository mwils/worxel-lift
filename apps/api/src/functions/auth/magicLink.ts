import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RequestMagicLinkDto, User } from "@lift/shared";
import { MAGIC_LINK_TTL_MIN } from "@lift/shared/constants";
import { generateMagicToken, signSessionCookie } from "../../lib/auth.js";
import { parseBody, withErrorBoundary, handleKnownErrors } from "../../lib/middleware.js";
import { sendEmail } from "../../lib/ses.js";
import { ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const { email } = await parseBody(event, RequestMagicLinkDto);
    const normalized = email.toLowerCase().trim();

    const { token, hash } = generateMagicToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);
    const verifyUrl = `${process.env.WEB_APP_URL ?? ""}/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalized)}`;

    let existing = await User.findOne({ email: normalized }).lean();

    if (!existing) {
      // Fresh email — create the account and sign them in immediately, no
      // round-trip. The link still goes out; clicking it flips emailVerified,
      // which unlocks outbound sends to customers (see withVerifiedAuth).
      let created = null;
      try {
        created = await User.create({
          email: normalized,
          role: "owner",
          emailVerified: false,
          auth: { magicLinkHash: hash, magicLinkExpiresAt: expiresAt },
        });
      } catch (err) {
        // Unique-index race: a concurrent request claimed this email between
        // findOne and create. Fall through to the existing-account path.
        if ((err as { code?: number }).code !== 11000) throw err;
        existing = await User.findOne({ email: normalized }).lean();
      }

      if (created) {
        // Best-effort: they're already signed in and can resend from the
        // in-app banner if this never lands.
        try {
          await sendEmail({
            to: normalized,
            subject: "Confirm your email for Lift",
            text: `Welcome to Lift! Tap the link below to confirm this email address. Your sign-in links go here, and confirming unlocks texting your customers.\n\n${verifyUrl}\n\nIf you didn't sign up for Lift, ignore this email.`,
          });
        } catch (err) {
          console.error("[magicLink] confirmation email failed", err);
        }

        const cookie = await signSessionCookie({
          userId: created._id.toString(),
          email: created.email,
          role: "owner",
        });
        return ok(
          { ok: true, signedIn: true, needsOnboarding: true },
          { headers: { "Set-Cookie": cookie } }
        );
      }
    }

    // Existing account — the email round-trip stays mandatory (it IS the
    // credential). Wording depends on whether they've confirmed yet: a resend
    // from the banner should read as "confirm", not "sign in".
    await User.updateOne(
      { email: normalized },
      { $set: { "auth.magicLinkHash": hash, "auth.magicLinkExpiresAt": expiresAt } }
    );

    const unconfirmed = existing?.emailVerified === false;
    await sendEmail({
      to: normalized,
      subject: unconfirmed ? "Confirm your email for Lift" : "Your Lift sign-in link",
      text: unconfirmed
        ? `Tap the link below to confirm this email address for Lift. Confirming unlocks texting your customers.\n\n${verifyUrl}\n\nIf you didn't sign up for Lift, ignore this email.`
        : `Tap the link below to sign in. It expires in ${MAGIC_LINK_TTL_MIN} minutes.\n\n${verifyUrl}\n\nIf you didn't request this, ignore this email.`,
    });

    return ok({ ok: true, signedIn: false });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
