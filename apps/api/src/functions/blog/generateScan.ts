import { connectDb } from "@lift/shared/db";
import { topUpBlogQueue } from "./topUp.js";

/**
 * Daily cron (BlogGenerateScan, 09:00 UTC ≈ 3–4am Central) — flips overdue
 * scheduled posts to published (bookkeeping) and tops the forward queue back
 * up to 7 drafts. Short-circuits generation unless BLOG_GENERATION_ENABLED=1,
 * mirroring the MOCK_SMS pattern on the reminders cron.
 */
export const handler = async () => {
  await connectDb();
  return topUpBlogQueue();
};
