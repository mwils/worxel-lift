import type { HydratedDocument } from "mongoose";
import { connectDb } from "@lift/shared/db";
import {
  AiInteraction,
  Customer,
  Message,
  SERVICE_INTERVALS,
  SERVICE_REMINDER_LOOKBACK_DAYS,
  SERVICE_REMINDER_TOLERANCE_DAYS,
  ServiceReminder,
  Shop,
  User,
  Vehicle,
  type ServiceReminderDoc,
} from "@lift/shared";
import {
  SERVICE_REMINDER_PROMPT_VERSION,
  buildServiceReminderFallback,
  buildServiceReminderPrompt,
} from "@lift/shared/prompts";
import { invokeClaude, modelClassify } from "../../lib/bedrock.js";
import { sendSms } from "../../lib/sms.js";

type ServiceReminderHydrated = HydratedDocument<ServiceReminderDoc>;

const DAY_MS = 86_400_000;
/** Cap so a single tick can't blast through the whole queue (or Bedrock budget). */
const PER_RUN_LIMIT = 200;

/**
 * Daily cron handler — finds pending reminders that are due now, drafts a one-
 * line SMS via Haiku (deterministic fallback on error), sends it through our
 * sms.ts wrapper, and bookkeeps Message + AiInteraction + reminder status.
 *
 * Triggered by the `ServiceReminderDailyScan` sst.aws.Cron at 16:00 UTC
 * (~10am Central). Serial processing on purpose — we don't want to fan out
 * 200 concurrent Bedrock + SMS calls.
 */
export const handler = async () => {
  await connectDb();

  // Decision #6 from the plan: do NOT fire reminders while MOCK_SMS is on.
  // Reminder volume × mock-as-email = 40 emails per cron tick during the
  // 10DLC review period, which buries the owner inbox. Flip MOCK_SMS off
  // (real SMS) before relying on this cron.
  if (process.env.MOCK_SMS === "1") {
    console.log("[remindersCron] MOCK_SMS=1 — skipping run");
    return { skipped: true, reason: "mock_sms" } as const;
  }

  const now = new Date();
  const upperBound = new Date(now.getTime() + SERVICE_REMINDER_TOLERANCE_DAYS * DAY_MS);
  const lowerBound = new Date(now.getTime() - SERVICE_REMINDER_LOOKBACK_DAYS * DAY_MS);

  const due = await ServiceReminder.find({
    status: "pending",
    dueAt: { $gte: lowerBound, $lte: upperBound },
  })
    .sort({ dueAt: 1 })
    .limit(PER_RUN_LIMIT)
    .exec();

  console.log(`[remindersCron] picked ${due.length} reminders (cap ${PER_RUN_LIMIT})`);

  let sent = 0;
  let optedOut = 0;
  let skipped = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      const result = await processReminder(reminder);
      if (result === "sent") sent++;
      else if (result === "opted_out") optedOut++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error("[remindersCron] reminder failed", {
        reminderId: String(reminder._id),
        error: (err as Error).message,
      });
      try {
        reminder.status = "failed";
        reminder.attempt = (reminder.attempt ?? 0) + 1;
        await reminder.save();
      } catch (saveErr) {
        console.error("[remindersCron] failed-status save also failed", saveErr);
      }
    }
  }

  console.log("[remindersCron] done", { sent, optedOut, skipped, failed });
  return { sent, optedOut, skipped, failed } as const;
};

async function processReminder(
  reminder: ServiceReminderHydrated
): Promise<"sent" | "opted_out" | "skipped"> {
  const shop = await Shop.findById(reminder.shopId).lean();
  if (!shop) {
    console.log("[remindersCron] shop missing", String(reminder.shopId));
    return "skipped";
  }
  if (shop.settings?.serviceRemindersEnabled === false) {
    return "skipped";
  }

  const customer = await Customer.findOne({
    _id: reminder.customerId,
    shopId: reminder.shopId,
  }).lean();
  if (!customer) {
    console.log("[remindersCron] customer missing", String(reminder.customerId));
    return "skipped";
  }
  if (customer.smsOptOutAt) {
    reminder.status = "opted_out";
    await reminder.save();
    return "opted_out";
  }

  const vehicle = await Vehicle.findOne({
    _id: reminder.vehicleId,
    shopId: reminder.shopId,
  }).lean();

  // Owner email for the mock fallback path (no-op when real SMS is enabled).
  const ownerUser = shop.ownerUserId
    ? await User.findById(shop.ownerUserId).select("email").lean()
    : null;
  const mockEmailRecipient = customer.email ?? ownerUser?.email ?? undefined;

  // We want "days since the source service" for the prompt copy ("we did your
  // oil change ~90 days ago"). dueAt = completedAt + interval, so the elapsed
  // time since completion is (now - dueAt) + interval.
  const intervalDays = SERVICE_INTERVALS[reminder.category].days;
  const daysSinceDue = Math.round(
    (Date.now() - new Date(reminder.dueAt).getTime()) / DAY_MS
  );
  const daysSinceService = Math.max(1, daysSinceDue + intervalDays);

  const promptInput = {
    shopName: shop.name,
    customerFirstName: customer.firstName,
    vehicle: {
      year: vehicle?.year ?? null,
      make: vehicle?.make ?? null,
      model: vehicle?.model ?? null,
    },
    category: reminder.category,
    daysSinceService,
    aiTone: (shop.settings?.aiTone === "friendly" ? "friendly" : "plain") as
      | "friendly"
      | "plain",
  };

  const model = modelClassify(); // Haiku — cheaper than the draft model.
  const start = Date.now();
  let body = "";
  let invokeResult: Awaited<ReturnType<typeof invokeClaude>> | null = null;
  let invokeError: string | undefined;

  try {
    invokeResult = await invokeClaude({
      modelId: model,
      prompt: buildServiceReminderPrompt(promptInput),
      maxTokens: 80,
      temperature: 0.3,
    });
    body = invokeResult.text
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\s+\n/g, "\n");
  } catch (err) {
    invokeError = (err as Error).message;
    console.error("[remindersCron] bedrock error — falling back", invokeError);
  }

  if (!body) {
    body = buildServiceReminderFallback(promptInput);
  }

  await AiInteraction.create({
    shopId: shop._id,
    kind: "service_reminder",
    model,
    promptVersion: SERVICE_REMINDER_PROMPT_VERSION,
    inputTokens: invokeResult?.inputTokens,
    outputTokens: invokeResult?.outputTokens,
    durationMs: Date.now() - start,
    error: invokeError,
  });

  const sendRes = await sendSms({
    to: customer.phone,
    from: shop.sms?.phoneNumber ?? undefined,
    body,
    mockEmailRecipient,
  });

  const outbound = await Message.create({
    shopId: shop._id,
    customerId: customer._id,
    direction: "out",
    body,
    awsMessageId: sendRes.messageId,
    aiDrafted: true,
    aiModel: model,
    aiPromptVersion: SERVICE_REMINDER_PROMPT_VERSION,
    serviceReminderId: reminder._id,
    autoReplied: false,
  });

  reminder.status = "sent";
  reminder.sentAt = new Date();
  reminder.sentMessageId = outbound._id;
  reminder.promptVersion = SERVICE_REMINDER_PROMPT_VERSION;
  await reminder.save();

  return "sent";
}

