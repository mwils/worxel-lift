/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 stack for Lift.
 *
 * Resources:
 *   - PhotosBucket          — S3 bucket for RO photos (presigned uploads)
 *   - SmsInboundTopic       — SNS topic that AWS End User Messaging publishes inbound SMS to
 *   - Api                   — HTTP API + per-route Lambdas
 *   - Web                   — React + Vite + Mantine PWA (CloudFront + S3)
 *   - Marketing             — Pre-rendered landing page (CloudFront + S3)
 *
 * Secrets (set with `sst secret set <Name> <value> --stage <stage>`):
 *   MongodbUri, JwtSecret, StripeSecretKey, StripePublishableKey,
 *   StripeWebhookSecret, StripePriceLift79, SesFromEmail, SmsPoolId
 */
export default $config({
  app(input) {
    return {
      name: "lift",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: process.env.AWS_REGION || "us-east-1",
          profile: process.env.AWS_PROFILE || "matthew",
        },
      },
    };
  },
  async run() {
    // ── Secrets ─────────────────────────────────────────────────
    const MongodbUri = new sst.Secret("MongodbUri");
    const JwtSecret = new sst.Secret("JwtSecret");
    const StripeSecretKey = new sst.Secret("StripeSecretKey");
    const StripePublishableKey = new sst.Secret("StripePublishableKey");
    const StripeWebhookSecret = new sst.Secret("StripeWebhookSecret");
    const StripePriceLift79 = new sst.Secret("StripePriceLift79");
    const SesFromEmail = new sst.Secret("SesFromEmail");
    const SmsPoolId = new sst.Secret("SmsPoolId");

    // ── Storage ─────────────────────────────────────────────────
    const photosBucket = new sst.aws.Bucket("PhotosBucket");

    // ── SMS inbound topic (subscribed by snsInbound Lambda) ─────
    const smsInboundTopic = new sst.aws.SnsTopic("SmsInboundTopic");
    const smsDeliveryTopic = new sst.aws.SnsTopic("SmsDeliveryTopic");

    // ── Common Lambda config ────────────────────────────────────
    const commonLink = [
      photosBucket,
      smsInboundTopic,
      smsDeliveryTopic,
      MongodbUri,
      JwtSecret,
      StripeSecretKey,
      StripePublishableKey,
      StripeWebhookSecret,
      StripePriceLift79,
      SesFromEmail,
      SmsPoolId,
    ];

    const commonPermissions = [
      { actions: ["bedrock:InvokeModel"], resources: ["*"] },
      { actions: ["ses:SendEmail", "ses:SendRawEmail"], resources: ["*"] },
      { actions: ["sms-voice:SendTextMessage"], resources: ["*"] },
      // Voice-to-RO uses Amazon Transcribe + needs to read the audio S3 object.
      {
        actions: ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"],
        resources: ["*"],
      },
      { actions: ["s3:GetObject"], resources: [$interpolate`${photosBucket.arn}/*`] },
    ];

    // ── Custom domains ──────────────────────────────────────────
    // Hosted zone: worxel.com (Route 53, same AWS account → SST auto-discovers).
    // Adjust per stage as you add more environments.
    const domains = {
      api: "api-lift.worxel.com",
      web: "lift-app.worxel.com",
      marketing: "lift.worxel.com",
    };
    const urls = {
      api: `https://${domains.api}`,
      web: `https://${domains.web}`,
      marketing: `https://${domains.marketing}`,
    };

    const commonEnv = {
      MONGODB_URI: MongodbUri.value,
      MONGODB_DB_NAME: "lift",
      JWT_SECRET: JwtSecret.value,
      STRIPE_SECRET_KEY: StripeSecretKey.value,
      STRIPE_PUBLISHABLE_KEY: StripePublishableKey.value,
      STRIPE_WEBHOOK_SECRET: StripeWebhookSecret.value,
      STRIPE_PRICE_ID_LIFT_79: StripePriceLift79.value,
      SES_FROM_EMAIL: SesFromEmail.value,
      SMS_POOL_ID: SmsPoolId.value,
      S3_PHOTOS_BUCKET: photosBucket.name,
      SMS_INBOUND_SNS_TOPIC_ARN: smsInboundTopic.arn,
      // Bedrock requires cross-region inference profile IDs (us./eu./apac. prefix)
      // for the 4.x Claude models — on-demand invocation of the bare model ID
      // returns "Invocation … with on-demand throughput isn't supported."
      BEDROCK_MODEL_DRAFT: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      BEDROCK_MODEL_CLASSIFY: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      // Mock outbound SMS until the 10DLC campaign is approved and the
      // origination pool has real numbers. CloudWatch logs the would-be SMS.
      MOCK_SMS: "1",
      WEB_APP_URL: urls.web,
      MARKETING_URL: urls.marketing,
      API_URL: urls.api,
      // Cookie domain set to the registrable domain so api → web subdomain
      // requests carry the lift_session cookie.
      COOKIE_DOMAIN: ".worxel.com",
    } as const;

    const fn = (handler: string) => ({
      handler,
      runtime: "nodejs20.x" as const,
      timeout: "15 seconds" as const,
      memory: "512 MB" as const,
      link: commonLink,
      permissions: commonPermissions,
      environment: commonEnv,
    });

    // ── HTTP API + routes ───────────────────────────────────────
    const api = new sst.aws.ApiGatewayV2("Api", {
      domain: domains.api,
      cors: {
        allowCredentials: true,
        allowOrigins: [urls.web, urls.marketing, "http://localhost:5173", "http://localhost:5174"],
        allowHeaders: ["content-type", "authorization"],
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      },
    });

    // auth
    api.route("POST /auth/magic-link", fn("apps/api/src/functions/auth/magicLink.handler"));
    api.route("POST /auth/sms-code", fn("apps/api/src/functions/auth/smsCode.handler"));
    api.route("POST /auth/verify", fn("apps/api/src/functions/auth/verify.handler"));
    api.route("POST /auth/logout", fn("apps/api/src/functions/auth/logout.handler"));
    api.route("GET /auth/me", fn("apps/api/src/functions/auth/me.handler"));

    // onboarding
    api.route("POST /onboard/shop", fn("apps/api/src/functions/onboard/shop.handler"));
    api.route("POST /onboard/sms-verify", fn("apps/api/src/functions/onboard/smsVerify.handler"));
    api.route(
      "POST /onboard/stripe-setup-intent",
      fn("apps/api/src/functions/onboard/stripeSetup.handler")
    );

    // shop
    api.route("GET /shop", fn("apps/api/src/functions/shop/get.handler"));
    api.route("PATCH /shop", fn("apps/api/src/functions/shop/patch.handler"));

    // billing portal
    api.route(
      "POST /billing/portal-session",
      fn("apps/api/src/functions/billing/portal.handler")
    );

    // data export (zip can take a moment; bump memory for archiver throughput)
    api.route("GET /data/export", {
      ...fn("apps/api/src/functions/data/export.handler"),
      memory: "1024 MB" as const,
      timeout: "30 seconds" as const,
    });

    // customers
    api.route("GET /customers", fn("apps/api/src/functions/customers/list.handler"));
    api.route("POST /customers", fn("apps/api/src/functions/customers/create.handler"));
    api.route("GET /customers/{id}", fn("apps/api/src/functions/customers/get.handler"));
    api.route("PATCH /customers/{id}", fn("apps/api/src/functions/customers/patch.handler"));
    api.route(
      "GET /customers/{id}/history",
      fn("apps/api/src/functions/customers/history.handler")
    );

    // vehicles
    api.route("POST /vehicles", fn("apps/api/src/functions/vehicles/create.handler"));
    api.route("PATCH /vehicles/{id}", fn("apps/api/src/functions/vehicles/patch.handler"));
    api.route("POST /vehicles/decode-vin", fn("apps/api/src/functions/vehicles/decodeVin.handler"));
    api.route(
      "GET /vehicles/{id}/history",
      fn("apps/api/src/functions/vehicles/history.handler")
    );

    // global lookup (Spotlight)
    api.route("GET /lookup", fn("apps/api/src/functions/lookup.handler"));

    // repair orders
    api.route("GET /repair-orders", fn("apps/api/src/functions/repairOrders/list.handler"));
    api.route("POST /repair-orders", fn("apps/api/src/functions/repairOrders/create.handler"));
    api.route("GET /repair-orders/{id}", fn("apps/api/src/functions/repairOrders/get.handler"));
    api.route("PATCH /repair-orders/{id}", fn("apps/api/src/functions/repairOrders/patch.handler"));
    api.route(
      "POST /repair-orders/{id}/line-items",
      fn("apps/api/src/functions/repairOrders/lineItems.createHandler")
    );
    api.route(
      "PATCH /repair-orders/{id}/line-items/{lineId}",
      fn("apps/api/src/functions/repairOrders/lineItems.patchHandler")
    );
    api.route(
      "DELETE /repair-orders/{id}/line-items/{lineId}",
      fn("apps/api/src/functions/repairOrders/lineItems.deleteHandler")
    );
    api.route(
      "POST /repair-orders/{id}/photos/presign",
      fn("apps/api/src/functions/repairOrders/photosPresign.handler")
    );
    api.route(
      "POST /repair-orders/{id}/photos/confirm",
      fn("apps/api/src/functions/repairOrders/photosConfirm.handler")
    );
    api.route(
      "POST /repair-orders/{id}/voice/presign",
      fn("apps/api/src/functions/repairOrders/voicePresign.handler")
    );
    api.route(
      "POST /repair-orders/{id}/voice-to-ro",
      fn("apps/api/src/functions/repairOrders/voiceToRo.handler")
    );
    api.route(
      "POST /repair-orders/{id}/send-estimate",
      fn("apps/api/src/functions/repairOrders/sendEstimate.handler")
    );
    api.route(
      "POST /repair-orders/{id}/inspection/items",
      fn("apps/api/src/functions/repairOrders/inspectionItem.createHandler")
    );
    api.route(
      "PATCH /repair-orders/{id}/inspection/items/{itemId}",
      fn("apps/api/src/functions/repairOrders/inspectionItem.patchHandler")
    );
    api.route(
      "DELETE /repair-orders/{id}/inspection/items/{itemId}",
      fn("apps/api/src/functions/repairOrders/inspectionItem.deleteHandler")
    );
    api.route(
      "POST /repair-orders/{id}/send-inspection",
      fn("apps/api/src/functions/repairOrders/sendInspection.handler")
    );

    // job templates (saved jobs)
    api.route("GET /job-templates", fn("apps/api/src/functions/jobTemplates/list.handler"));
    api.route("POST /job-templates", fn("apps/api/src/functions/jobTemplates/create.handler"));
    api.route(
      "GET /job-templates/starter-library",
      fn("apps/api/src/functions/jobTemplates/starterLibrary.handler")
    );
    api.route(
      "POST /job-templates/import-starter",
      fn("apps/api/src/functions/jobTemplates/importStarter.handler")
    );
    api.route("GET /job-templates/{id}", fn("apps/api/src/functions/jobTemplates/get.handler"));
    api.route("PATCH /job-templates/{id}", fn("apps/api/src/functions/jobTemplates/patch.handler"));
    api.route("DELETE /job-templates/{id}", fn("apps/api/src/functions/jobTemplates/del.handler"));
    api.route(
      "POST /job-templates/{id}/apply",
      fn("apps/api/src/functions/jobTemplates/apply.handler")
    );

    // service-due reminders
    api.route(
      "GET /service-reminders",
      fn("apps/api/src/functions/serviceReminders/list.handler")
    );
    api.route(
      "PATCH /service-reminders/{id}",
      fn("apps/api/src/functions/serviceReminders/patch.handler")
    );
    api.route(
      "POST /service-reminders/disable-for-vehicle",
      fn("apps/api/src/functions/serviceReminders/disableForVehicle.handler")
    );

    // messages
    api.route(
      "GET /messages/conversation/{customerId}",
      fn("apps/api/src/functions/messages/conversation.handler")
    );
    api.route("POST /messages/draft", fn("apps/api/src/functions/messages/draft.handler"));
    api.route("POST /messages/send", fn("apps/api/src/functions/messages/send.handler"));

    // payments
    api.route(
      "POST /payments/create-link",
      fn("apps/api/src/functions/payments/createLink.handler")
    );
    api.route("POST /payments/save-card", fn("apps/api/src/functions/payments/saveCard.handler"));
    api.route("POST /payments/charge", fn("apps/api/src/functions/payments/charge.handler"));

    // webhooks
    api.route("POST /webhooks/stripe", fn("apps/api/src/functions/webhooks/stripe.handler"));

    // public (token-scoped, no auth)
    api.route("GET /public/estimate/{token}", fn("apps/api/src/functions/public/getEstimate.handler"));
    api.route(
      "POST /public/estimate/{token}/approve",
      fn("apps/api/src/functions/public/approveEstimate.handler")
    );
    api.route(
      "POST /public/estimate/{token}/decline",
      fn("apps/api/src/functions/public/declineEstimate.handler")
    );
    api.route("GET /public/pay/{token}", fn("apps/api/src/functions/public/getPay.handler"));
    api.route("POST /public/pay/{token}", fn("apps/api/src/functions/public/pay.handler"));
    api.route(
      "GET /public/inspection/{token}",
      fn("apps/api/src/functions/public/getInspection.handler")
    );

    // public booking (token + slug scoped, no auth)
    api.route("GET /public/book/{slug}", fn("apps/api/src/functions/public/getBook.handler"));
    api.route(
      "GET /public/book/{slug}/slots",
      fn("apps/api/src/functions/public/getBookSlots.handler")
    );
    api.route("POST /public/book/{slug}", fn("apps/api/src/functions/public/book.handler"));
    api.route(
      "GET /public/booking/{token}",
      fn("apps/api/src/functions/public/getBooking.handler")
    );
    api.route(
      "POST /public/booking/{token}/reschedule",
      fn("apps/api/src/functions/public/rescheduleBooking.handler")
    );
    api.route(
      "POST /public/booking/{token}/cancel",
      fn("apps/api/src/functions/public/cancelBooking.handler")
    );

    // ── SNS subscribers ─────────────────────────────────────────
    smsInboundTopic.subscribe(
      "SmsInboundSubscriber",
      fn("apps/api/src/functions/webhooks/snsInbound.handler")
    );
    smsDeliveryTopic.subscribe(
      "SmsDeliverySubscriber",
      fn("apps/api/src/functions/webhooks/snsDelivery.handler")
    );

    // ── Scheduled jobs ──────────────────────────────────────────
    // First cron in the stack — service-reminder dailyScan. Runs daily at
    // 16:00 UTC (~10am Central). The handler itself short-circuits when
    // MOCK_SMS=1 so this is safe to provision before the 10DLC campaign
    // clears review.
    new sst.aws.Cron("ServiceReminderDailyScan", {
      schedule: "cron(0 16 * * ? *)",
      function: {
        ...fn("apps/api/src/functions/serviceReminders/dailyScan.handler"),
        // The scan can fan out to 200 reminders × (Bedrock + SMS) sequentially.
        // The 15s default is too tight; bump to 5 minutes.
        timeout: "5 minutes" as const,
        memory: "1024 MB" as const,
      },
    });

    // ── Static sites ────────────────────────────────────────────
    const web = new sst.aws.StaticSite("Web", {
      path: "apps/web",
      domain: domains.web,
      build: { command: "pnpm build", output: "dist" },
      environment: { VITE_API_URL: urls.api, VITE_MARKETING_URL: urls.marketing },
    });

    const marketing = new sst.aws.StaticSite("Marketing", {
      path: "apps/marketing",
      domain: domains.marketing,
      build: { command: "pnpm build", output: "dist" },
      environment: { VITE_API_URL: urls.api, VITE_WEB_APP_URL: urls.web },
    });

    return {
      api: api.url,
      web: web.url,
      marketing: marketing.url,
      photosBucket: photosBucket.name,
      smsInboundTopic: smsInboundTopic.arn,
    };
  },
});
