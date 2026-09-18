/**
 * Detach a shop's Stripe Connect account so "Set up payments" starts over.
 * Needed when switching the API keys between Stripe live and test mode: a
 * live acct_… id is unknown to test mode (and vice versa), so connect/refresh
 * would 404 forever. Does NOT touch the Stripe side — the old account stays
 * in the dashboard's Connected accounts list.
 *
 * Dry run by default; pass --apply to write. Scope to one shop with --shop=<id>,
 * otherwise every shop with a connect account is listed / reset.
 *
 *   MONGODB_URI="…" pnpm --filter @lift/api exec tsx scripts/resetConnectAccount.ts
 *   MONGODB_URI="…" pnpm --filter @lift/api exec tsx scripts/resetConnectAccount.ts --apply
 */
import { Shop, connectDb } from "@lift/shared";

const apply = process.argv.includes("--apply");
const shopArg = process.argv.find((a) => a.startsWith("--shop="))?.slice("--shop=".length);

await connectDb();

const filter: Record<string, unknown> = { "stripe.connectAccountId": { $exists: true } };
if (shopArg) filter._id = shopArg;

const shops = await Shop.find(filter, { name: 1, stripe: 1 }).lean();
for (const s of shops) {
  console.log(
    `${apply ? "Resetting" : "Would reset"} ${s.name} (${String(s._id)}): ` +
      `${s.stripe?.connectAccountId} chargesEnabled=${s.stripe?.connectChargesEnabled ?? "-"}`
  );
}

if (apply && shops.length > 0) {
  const r = await Shop.updateMany(
    { _id: { $in: shops.map((s) => s._id) } },
    {
      $unset: {
        "stripe.connectAccountId": "",
        "stripe.connectChargesEnabled": "",
        "stripe.connectDetailsSubmitted": "",
        "stripe.connectCreateAttempt": "",
      },
    }
  );
  console.log(`Reset ${r.modifiedCount} shop(s).`);
} else if (shops.length === 0) {
  console.log("No shops with a connect account.");
}
process.exit(0);
