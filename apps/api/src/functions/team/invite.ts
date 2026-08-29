import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { InviteMemberDto, Shop, User } from "@lift/shared";
import { generateMagicToken } from "../../lib/auth.js";
import { handleKnownErrors, parseBody, withOwnerAuth } from "../../lib/middleware.js";
import { sendEmail } from "../../lib/ses.js";
import { badRequest, conflict, created, notFound } from "../../lib/response.js";

// Invite links live longer than sign-in links — a tech may not open the
// email until their next shift.
const INVITE_TTL_HOURS = 72;

/**
 * POST /team/invites  (owner only)
 *
 * Adds a tech to the owner's shop and emails them a sign-in link. There's no
 * separate "invitation" record: the tech's user row is created (or, for an
 * account that signed up but never made a shop, claimed) with this shopId and
 * role "tech", so the normal magic-link verify lands them straight in the shop.
 * Re-inviting a pending tech just re-sends the link.
 */
export const handler: APIGatewayProxyHandlerV2 = withOwnerAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, InviteMemberDto);
    const email = dto.email.toLowerCase().trim();

    if (email === user.email.toLowerCase()) return badRequest("That's your own email");

    const shop = await Shop.findById(user.shopId).select("name").lean();
    if (!shop) return notFound("Shop not found");

    const { token, hash } = generateMagicToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    const authPatch = { "auth.magicLinkHash": hash, "auth.magicLinkExpiresAt": expiresAt };

    const existing = await User.findOne({ email }).lean();
    let resent = false;

    if (existing?.shopId && String(existing.shopId) !== user.shopId) {
      return conflict("That email already belongs to another shop's account");
    }

    if (existing) {
      // Same shop (pending or active) → resend. No shop → claim the account.
      resent = String(existing.shopId) === user.shopId;
      const set: Record<string, unknown> = { ...authPatch };
      if (!resent) {
        set.shopId = user.shopId;
        set.role = "tech";
      }
      if (dto.phone && !existing.phone) set.phone = dto.phone;
      await User.updateOne({ _id: existing._id }, { $set: set });
    } else {
      await User.create({
        email,
        phone: dto.phone,
        shopId: user.shopId,
        role: "tech",
        emailVerified: false,
        auth: { magicLinkHash: hash, magicLinkExpiresAt: expiresAt },
      });
    }

    const verifyUrl = `${process.env.WEB_APP_URL ?? ""}/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: `You've been added to ${shop.name} on Lift`,
      text:
        `${user.email} added you to ${shop.name} on Lift. Tap the link below to sign in — it works for ${INVITE_TTL_HOURS} hours.\n\n${verifyUrl}\n\n` +
        `After that, sign in any time at ${process.env.WEB_APP_URL ?? ""} with this email address` +
        (dto.phone ? " or a text code to your phone." : ".") +
        `\n\nIf you weren't expecting this, ignore this email.`,
    });

    return created({ ok: true, resent });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
