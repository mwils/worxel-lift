# Lift 10DLC campaign registration — paste-ready field values

Submit in the AWS console: **End User Messaging → SMS & RCS → Registrations →
Create → US 10DLC campaign registration**, under the existing approved brand
(AICHEETAH IO LLC dba Worxel, `registration-305058f0b4004933bfac734601f6a5f7`).

Context: the existing campaign (`registration-60fc6026a5c6481c8762d6c20275a067`)
is Aerotraks security alerts — no embedded links, different opt-in. Lift traffic
(estimates, pay links) must NOT ride on it. This registers a dedicated Lift
campaign; after approval, buy a new 10DLC number attached to it, set the
`SmsPoolId` secret to the new number's id, and enable two-way messaging on it
pointing at `SmsInboundTopic` (same as the current number).

---

## Campaign info

## Rejection round 1 (2026-08-20) — fixes

AWS/TCR returned "Requires update" with three findings. Resubmission changes:

1. **Opt-in message mismatch** — vetting requires the registered brand or DBA
   ("Worxel") literally in the opt-in confirmation. Fixed text below (and in
   the product: `customers/create.ts` sends the same string).
2. **Opt-out message mismatch** — same for the STOP response. Fixed below.
3. **Invalid brand business connection** (brand looks like an ISV; website
   mismatch — brand site was aerotraks.com, campaign is lift.worxel.com):
   - Parent-company page now live at **https://worxel.com** (apps/company)
     naming AICHEETAH IO LLC dba Worxel and both products.
   - **Update the BRAND registration's website field to https://worxel.com**
     (Registrations → the brand → edit contact info). This makes the brand
     site cover both the Aerotraks and Lift campaigns.
   - Campaign description below now opens with the brand connection, and
     sample messages carry "via Worxel Lift" so the sender identity is the
     registered brand, not the individual shop.

**Campaign name / description**

> Worxel Lift is shop-management software built, operated, and sold by
> AICHEETAH IO LLC dba Worxel (worxel.com) — Worxel is the end brand sending
> these messages, not a reseller or ISV for other brands. Lift
> (lift.worxel.com) is used by small independent auto repair shops to
> send transactional SMS to their own customers about vehicles currently in for
> service: repair estimates with an approval link, repair status updates,
> vehicle-ready notifications, payment links, and replies to customer-initiated
> questions. No marketing or promotional content. Customers opt in in person at
> the shop's service counter when their vehicle is written up.

**Vertical:** Technology
**Message type:** Transactional
**Number capabilities:** SMS

## Use case

- **Use case:** Low volume (mixed)
- **Sub use cases:** Customer care, Account notification, Delivery notification
- **Embedded link:** **Yes** (estimate approval and payment links on lift-app.worxel.com)
- **Embedded phone number:** No
- **Age-gated content:** No
- **Direct lending:** No
- **Subscriber opt-in:** Yes · **Subscriber opt-out:** Yes · **Subscriber help:** Yes

## Opt-in workflow description

> Consent is collected in person, at the point of service. When a customer
> brings their vehicle to a participating repair shop, the shop writes up the
> repair order at the service counter and asks the customer for their mobile
> number to receive text updates about their vehicle. The shop's staff reads or
> shows the disclosure: "By providing your phone number, you agree to receive
> SMS messages from [shop name] about your repair order. Reply STOP to opt out,
> HELP for help. Msg & data rates may apply." The Lift software displays a
> confirmation requirement when the number is entered: "By adding this number
> you confirm the customer agreed to receive service texts about their vehicle.
> Msg frequency varies, msg & data rates may apply. They can reply STOP to opt
> out, HELP for help." Consent timestamp is stored on the customer record
> (smsOptInAt). STOP is honored automatically: the sender suppresses all future
> messages to opted-out numbers in addition to carrier-level blocking. Mobile
> information is never shared with third parties or affiliates for marketing.

**Opt-in screenshot attachment:** screenshot of the Lift "New customer" form
(lift-app.worxel.com → Customers → Add customer) showing the phone field with
its consent disclosure text.

## Program messages

**Opt-in confirmation message** (carrier vetting requires the registered brand
name or DBA — "Worxel" — to appear literally in the opt-in and opt-out texts)

> [Shop name] via Worxel Lift: You're set to get text updates about your
> vehicle. Msg frequency varies. Msg & data rates may apply. Reply HELP for
> help, STOP to cancel.

**HELP response**

> Worxel Lift service updates on behalf of your repair shop. Msg & data rates
> may apply. Email lift@worxel.com for help. Reply STOP to cancel.

**STOP response**

> Worxel Lift: You have been unsubscribed from repair updates and will receive
> no further messages. Reply START to resubscribe.

## Sample messages

1. > Mike's Auto via Worxel Lift: John — here's the estimate for your 1988
   > Ford Bronco: Brake pad replacement — $120.00, Tire balance and rotation —
   > $45.00. Total: $250.00. Review and approve:
   > https://lift-app.worxel.com/public/estimate/3M4AaNeRgT1XlU3CmoZ0M6zp8QZ9RZNJ
   >
   > (Live example URL — resolves to a real rendered estimate page, verified
   > 2026-08-19. Use this wherever the form asks for an embedded-link example
   > that must point to a public page.)
2. > Mike's Auto via Worxel Lift: parts for your F-150 arrived, repair is
   > underway. We'll text you when it's ready.
3. > Mike's Auto via Worxel Lift: your Civic is ready for pickup. Total is
   > $412.50 — pay ahead here if you like:
   > https://lift-app.worxel.com/public/pay/xyz789

## Links

- **Privacy policy:** https://lift.worxel.com/privacy
- **Terms and conditions:** https://lift.worxel.com/terms

(Both serve the combined Privacy Policy & Terms page, which carries the
carrier-required SMS disclosures: point-of-sale consent, STOP/HELP, "no mobile
information shared with third parties or affiliates for marketing.")

---

## After approval

1. Request a new 10DLC number ($1/mo) associated with this campaign.
2. `sst secret set SmsPoolId "<new phone-number id>" --stage dev` and redeploy.
3. Enable two-way messaging on the new number → SNS topic `SmsInboundTopic`
   (`aws pinpoint-sms-voice-v2 update-phone-number --phone-number-id <id>
   --two-way-enabled --two-way-channel-arn <topic arn>`).
4. Leave +17169858982 on the Aerotraks campaign.
