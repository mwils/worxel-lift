import { randomBytes } from "node:crypto";
import { Customer } from "@lift/shared";

/**
 * Customer history link — one tokenized, read-only page per customer
 * (`/public/account/:token`) that ties every receipt / inspection / booking
 * link together. The token lives on `customers.publicToken`, is minted the
 * first time anything needs it, and is rotated from the customer page.
 */

export function publicAccountUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/public/account/${token}`;
}

export function newAccountToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Return the customer's history-link token, minting one if it doesn't exist.
 * Uses an `$exists: false` guard so two concurrent first-uses (a receipt text
 * and a booking confirmation landing together) can't hand out different
 * tokens. Returns null when the customer is gone.
 */
export async function ensureCustomerPublicToken(customerId: unknown): Promise<string | null> {
  const existing = await Customer.findById(customerId).select({ publicToken: 1 }).lean();
  if (!existing) return null;
  if (existing.publicToken) return existing.publicToken;

  const token = newAccountToken();
  await Customer.updateOne(
    { _id: customerId, publicToken: { $exists: false } },
    { $set: { publicToken: token } }
  );
  // Re-read: if we lost the race, the other writer's token is the one that stuck.
  const after = await Customer.findById(customerId).select({ publicToken: 1 }).lean();
  return after?.publicToken ?? token;
}

/** The full URL, or null if the customer doesn't exist. */
export async function ensureCustomerHistoryUrl(customerId: unknown): Promise<string | null> {
  const token = await ensureCustomerPublicToken(customerId);
  return token ? publicAccountUrl(token) : null;
}
