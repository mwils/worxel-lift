import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { sendEmail } from "./ses.js";

let _client: PinpointSMSVoiceV2Client | null = null;

function client() {
  if (!_client) {
    _client = new PinpointSMSVoiceV2Client({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _client;
}

export interface SendSmsArgs {
  to: string; // E.164
  from?: string; // originating phone or pool id; falls back to env
  body: string;
  /**
   * When MOCK_SMS=1 (or LIFT_LOCAL_DEV=1), the SMS body is delivered as an
   * email to this address instead of going through AWS End User Messaging.
   * Callers should pass the relevant party's email (shop owner for internal
   * notifications, customer for customer-facing texts). If omitted, the mock
   * just logs to the Lambda's CloudWatch stream.
   */
  mockEmailRecipient?: string;
}

export async function sendSms(args: SendSmsArgs): Promise<{ messageId?: string }> {
  const mocked = process.env.LIFT_LOCAL_DEV === "1" || process.env.MOCK_SMS === "1";
  if (mocked) {
    const label = process.env.MOCK_SMS === "1" ? "mock" : "local-dev";

    if (args.mockEmailRecipient) {
      await sendEmail({
        to: args.mockEmailRecipient,
        subject: `[Lift SMS mock] would text ${args.to}`,
        text:
          `--- Mocked SMS body ---\n` +
          args.body +
          `\n\n--- Mock details ---\n` +
          `To:    ${args.to}\n` +
          `From:  ${args.from ?? process.env.SMS_POOL_ID ?? "(no pool)"}\n` +
          `Mode:  ${label}\n` +
          `(Set MOCK_SMS=0 in sst.config.ts once the 10DLC campaign is approved to send real SMS.)`,
      });
      return { messageId: `${label}-email-${Date.now()}` };
    }

    console.log(`\n📱 [${label}] would send SMS via End User Messaging:`);
    console.log(`   From: ${args.from ?? process.env.SMS_POOL_ID ?? "(no pool)"}`);
    console.log(`   To:   ${args.to}`);
    console.log(`   ─── body ───`);
    console.log(args.body.replace(/^/gm, "   "));
    console.log("");
    return { messageId: `${label}-${Date.now()}` };
  }

  const out = await client().send(
    new SendTextMessageCommand({
      DestinationPhoneNumber: args.to,
      OriginationIdentity: args.from ?? process.env.SMS_POOL_ID,
      MessageBody: args.body,
      MessageType: "TRANSACTIONAL",
      // Delivery receipts (TEXT_DELIVERED / TEXT_INVALID / …) only flow to the
      // SmsDeliveryTopic → snsDelivery Lambda when the send is tied to an End
      // User Messaging configuration set whose event destination is that topic.
      ConfigurationSetName: process.env.SMS_CONFIGURATION_SET || undefined,
    })
  );
  return { messageId: out.MessageId };
}
