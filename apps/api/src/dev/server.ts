import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// ── Load .env from repo root (resolved from this file's location) ──
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "../../../../.env");
const loaded = dotenv.config({ path: envPath });

// Local dev mode: SES/SMS log to console instead of calling AWS.
process.env.LIFT_LOCAL_DEV = "1";

// Sensible defaults so the server boots even with a minimal .env.
process.env.AWS_REGION ??= "us-east-1";
process.env.MONGODB_DB_NAME ??= "lift";
process.env.WEB_APP_URL ??= "http://localhost:5173";
process.env.MARKETING_URL ??= "http://localhost:5174";
process.env.API_URL ??= "http://localhost:4000";

import { toExpress } from "./adapter.js";

// ── Handlers ────────────────────────────────────────────────────
import { handler as authMagicLink } from "../functions/auth/magicLink.js";
import { handler as authSmsCode } from "../functions/auth/smsCode.js";
import { handler as authVerify } from "../functions/auth/verify.js";
import { handler as authLogout } from "../functions/auth/logout.js";
import { handler as authMe } from "../functions/auth/me.js";

import { handler as onboardShop } from "../functions/onboard/shop.js";
import { handler as teamList } from "../functions/team/list.js";
import { handler as teamInvite } from "../functions/team/invite.js";
import { handler as teamRemove } from "../functions/team/remove.js";
import { handler as onboardSmsVerify } from "../functions/onboard/smsVerify.js";
import { handler as onboardStripeSetup } from "../functions/onboard/stripeSetup.js";

import { handler as shopGet } from "../functions/shop/get.js";
import { handler as shopPatch } from "../functions/shop/patch.js";

import { handler as customersList } from "../functions/customers/list.js";
import { handler as customersCreate } from "../functions/customers/create.js";
import { handler as customersGet } from "../functions/customers/get.js";
import { handler as customersPatch } from "../functions/customers/patch.js";
import { handler as customersHistory } from "../functions/customers/history.js";
import { handler as customersHistoryLink } from "../functions/customers/historyLink.js";

import { handler as vehiclesCreate } from "../functions/vehicles/create.js";
import { handler as vehiclesPatch } from "../functions/vehicles/patch.js";
import { handler as vehiclesDecodeVin } from "../functions/vehicles/decodeVin.js";

import { handler as roList } from "../functions/repairOrders/list.js";
import { handler as roCreate } from "../functions/repairOrders/create.js";
import { handler as roGet } from "../functions/repairOrders/get.js";
import { handler as roPatch } from "../functions/repairOrders/patch.js";
import {
  createHandler as roLineItemCreate,
  patchHandler as roLineItemPatch,
  deleteHandler as roLineItemDelete,
} from "../functions/repairOrders/lineItems.js";
import { handler as roPhotosPresign } from "../functions/repairOrders/photosPresign.js";
import { handler as roPhotosConfirm } from "../functions/repairOrders/photosConfirm.js";
import { handler as roVoiceToRo } from "../functions/repairOrders/voiceToRo.js";
import { handler as roSendEstimate } from "../functions/repairOrders/sendEstimate.js";

import { handler as messagesConversation } from "../functions/messages/conversation.js";
import { handler as messagesDraft } from "../functions/messages/draft.js";
import { handler as messagesSend } from "../functions/messages/send.js";
import { handler as messagesInbox } from "../functions/messages/inbox.js";
import {
  read as threadRead,
  archive as threadArchive,
  unarchive as threadUnarchive,
} from "../functions/messages/thread.js";

import { handler as voicePresign } from "../functions/voice/presign.js";
import { handler as voiceTranscribe } from "../functions/voice/transcribe.js";

import { handler as paymentsCreateLink } from "../functions/payments/createLink.js";
import { handler as paymentsSaveCard } from "../functions/payments/saveCard.js";
import { handler as paymentsCharge } from "../functions/payments/charge.js";
import { handler as paymentsConnectStart } from "../functions/payments/connectStart.js";
import { handler as paymentsConnectStatus } from "../functions/payments/connectStatus.js";

import { handler as webhookStripe } from "../functions/webhooks/stripe.js";
import { handler as snsInboundHandler } from "../functions/webhooks/snsInbound.js";

import { handler as publicGetEstimate } from "../functions/public/getEstimate.js";
import { handler as publicApproveEstimate } from "../functions/public/approveEstimate.js";
import { handler as publicDeclineEstimate } from "../functions/public/declineEstimate.js";
import { handler as publicGetPay } from "../functions/public/getPay.js";
import { handler as publicPay } from "../functions/public/pay.js";
import { handler as publicGetAccount } from "../functions/public/getAccount.js";

// ── Server ──────────────────────────────────────────────────────
const app = express();

app.use(
  cors({
    origin: [process.env.WEB_APP_URL!, process.env.MARKETING_URL!],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// Health
app.get("/_dev/health", (_req, res) => {
  res.json({
    ok: true,
    mongoConfigured: !!process.env.MONGODB_URI,
    jwtConfigured: !!process.env.JWT_SECRET,
    sesConfigured: !!process.env.SES_FROM_EMAIL,
    bedrockConfigured: !!process.env.BEDROCK_MODEL_DRAFT,
    smsConfigured: !!process.env.SMS_POOL_ID,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});

// auth
app.post("/auth/magic-link", toExpress(authMagicLink));
app.post("/auth/sms-code", toExpress(authSmsCode));
app.post("/auth/verify", toExpress(authVerify));
app.post("/auth/logout", toExpress(authLogout));
app.get("/auth/me", toExpress(authMe));

// onboarding
app.post("/onboard/shop", toExpress(onboardShop));
app.get("/team", toExpress(teamList));
app.post("/team/invites", toExpress(teamInvite));
app.delete("/team/:userId", toExpress(teamRemove));
app.post("/onboard/sms-verify", toExpress(onboardSmsVerify));
app.post("/onboard/stripe-setup-intent", toExpress(onboardStripeSetup));

// shop
app.get("/shop", toExpress(shopGet));
app.patch("/shop", toExpress(shopPatch));

// customers
app.get("/customers", toExpress(customersList));
app.post("/customers", toExpress(customersCreate));
app.get("/customers/:id", toExpress(customersGet));
app.patch("/customers/:id", toExpress(customersPatch));
app.get("/customers/:id/history", toExpress(customersHistory));
app.post("/customers/:id/history-link", toExpress(customersHistoryLink));

// vehicles
app.post("/vehicles", toExpress(vehiclesCreate));
app.patch("/vehicles/:id", toExpress(vehiclesPatch));
app.post("/vehicles/decode-vin", toExpress(vehiclesDecodeVin));

// repair orders
app.get("/repair-orders", toExpress(roList));
app.post("/repair-orders", toExpress(roCreate));
app.get("/repair-orders/:id", toExpress(roGet));
app.patch("/repair-orders/:id", toExpress(roPatch));
app.post("/repair-orders/:id/line-items", toExpress(roLineItemCreate));
app.patch("/repair-orders/:id/line-items/:lineId", toExpress(roLineItemPatch));
app.delete("/repair-orders/:id/line-items/:lineId", toExpress(roLineItemDelete));
app.post("/repair-orders/:id/photos/presign", toExpress(roPhotosPresign));
app.post("/repair-orders/:id/photos/confirm", toExpress(roPhotosConfirm));
app.post("/repair-orders/:id/voice-to-ro", toExpress(roVoiceToRo));
app.post("/repair-orders/:id/send-estimate", toExpress(roSendEstimate));

// messages
app.get("/messages/conversation/:customerId", toExpress(messagesConversation));
app.post("/messages/draft", toExpress(messagesDraft));
app.post("/messages/send", toExpress(messagesSend));
app.get("/messages/inbox", toExpress(messagesInbox));
app.post("/messages/threads/:customerId/read", toExpress(threadRead));
app.post("/messages/threads/:customerId/archive", toExpress(threadArchive));
app.post("/messages/threads/:customerId/unarchive", toExpress(threadUnarchive));

// voice (shop-scoped)
app.post("/voice/presign", toExpress(voicePresign));
app.post("/voice/transcribe", toExpress(voiceTranscribe));

// payments
app.post("/payments/create-link", toExpress(paymentsCreateLink));
app.post("/payments/save-card", toExpress(paymentsSaveCard));
app.post("/payments/charge", toExpress(paymentsCharge));
app.post("/payments/connect/start", toExpress(paymentsConnectStart));
app.post("/payments/connect/refresh", toExpress(paymentsConnectStatus));

// webhooks
app.post("/webhooks/stripe", toExpress(webhookStripe));

// public
app.get("/public/estimate/:token", toExpress(publicGetEstimate));
app.post("/public/estimate/:token/approve", toExpress(publicApproveEstimate));
app.post("/public/estimate/:token/decline", toExpress(publicDeclineEstimate));
app.get("/public/pay/:token", toExpress(publicGetPay));
app.post("/public/pay/:token", toExpress(publicPay));
app.get("/public/account/:token", toExpress(publicGetAccount));

// dev-only: simulate an inbound SMS by hand-rolling an SNS event and
// invoking the snsInbound Lambda handler directly. Lets us exercise the
// classify → auto-reply flow without a real End User Messaging origin number.
app.post("/_dev/sns/inbound", async (req, res) => {
  const { from, to, body } = req.body as { from: string; to: string; body: string };
  if (!from || !to || !body) return res.status(400).json({ error: "from, to, body required" });
  const fakeEvent = {
    Records: [
      {
        EventSource: "aws:sns",
        EventVersion: "1.0",
        EventSubscriptionArn: "local",
        Sns: {
          Type: "Notification",
          MessageId: `local-${Date.now()}`,
          TopicArn: "local",
          Subject: undefined,
          Message: JSON.stringify({
            originationNumber: from,
            destinationNumber: to,
            messageBody: body,
            messageId: `local-${Date.now()}`,
          }),
          Timestamp: new Date().toISOString(),
          SignatureVersion: "1",
          Signature: "",
          SigningCertUrl: "",
          UnsubscribeUrl: "",
          MessageAttributes: {},
        },
      },
    ],
  };
  try {
    await snsInboundHandler(fakeEvent as any, {} as any, () => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log("");
  console.log(`🚀 Lift API dev server on http://localhost:${port}`);
  console.log(`   env loaded from: ${envPath} ${loaded.error ? "(file not found — that's ok)" : ""}`);
  console.log(`   LIFT_LOCAL_DEV=1 → magic links + SMS codes log to this terminal`);
  console.log(`   health: http://localhost:${port}/_dev/health`);
  console.log("");
});
