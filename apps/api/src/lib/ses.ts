import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let _client: SESClient | null = null;

function client() {
  if (!_client) {
    _client = new SESClient({
      region: process.env.SES_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _client;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const from = process.env.SES_FROM_EMAIL ?? "hello@lift.com";

  if (process.env.LIFT_LOCAL_DEV === "1") {
    console.log("\n📧 [local-dev] would send email via SES:");
    console.log(`   From:    ${from}`);
    console.log(`   To:      ${args.to}`);
    console.log(`   Subject: ${args.subject}`);
    console.log(`   ─── body ───`);
    console.log(args.text.replace(/^/gm, "   "));
    console.log("");
    return;
  }

  await client().send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [args.to] },
      Message: {
        Subject: { Charset: "UTF-8", Data: args.subject },
        Body: {
          Text: { Charset: "UTF-8", Data: args.text },
          ...(args.html ? { Html: { Charset: "UTF-8", Data: args.html } } : {}),
        },
      },
    })
  );
}
