import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RequestSmsCodeDto, User } from "@lift/shared";
import { SMS_CODE_TTL_MIN } from "@lift/shared/constants";
import { generateSmsCode } from "../../lib/auth.js";
import { handleKnownErrors, parseBody, withErrorBoundary } from "../../lib/middleware.js";
import { sendSms } from "../../lib/sms.js";
import { ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const { phone } = await parseBody(event, RequestSmsCodeDto);
    const { code, hash } = generateSmsCode();
    const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MIN * 60 * 1000);

    await User.updateOne(
      { phone },
      {
        $setOnInsert: { phone, role: "owner", email: `${phone}@phone.lift.local` },
        $set: { "auth.smsCode": hash, "auth.smsCodeExpiresAt": expiresAt },
      },
      { upsert: true }
    );

    await sendSms({
      to: phone,
      body: `Lift code: ${code}\nExpires in ${SMS_CODE_TTL_MIN} min.`,
    });

    return ok({ ok: true });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
