import Stripe from "stripe";

let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    _client = new Stripe(key, { apiVersion: "2024-10-28.acacia" as Stripe.LatestApiVersion });
  }
  return _client;
}
