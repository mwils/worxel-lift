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
3. **Invalid brand business connection** — the real trigger was almost
   certainly the old description's phrasing, *"Shops use Lift to send
   transactional SMS to **their own customers**"*: that is textbook
   ISV/reseller language (a platform messaging on behalf of other brands).
   Do NOT touch the brand registration to fix this (see below). Instead:
   - Description rewritten so **Worxel is the sender and end brand** — shops
     are the service context, not the sender. One Worxel-owned number, one
     brand, no third party sending.
   - Every message and sample identifies "Worxel Lift" as sender.
   - Parent-company page now live at **https://worxel.com** (apps/company)
     naming AICHEETAH IO LLC dba Worxel and both products, so the campaign
     domain and the brand are visibly the same company.

### Do not re-open the brand registration

The brand (`registration-305058f0b4004933bfac734601f6a5f7`) is COMPLETE,
approved at version 7, with `contactInfo.website = aerotraks.com`. The console
offers no edit, and while the API would technically accept a new version
(`create-registration-version`), submitting it sends the brand back through TCR
vetting — risking a re-vetting fee, a denial, and disruption to the already
approved Aerotraks campaign that depends on this brand. The website field is
not what the campaign vetter matches against; fix the connection at the
campaign level (above). Optional low-risk reinforcement: add an "A Worxel
company" footer link on aerotraks.com pointing to worxel.com, so the registered
brand website itself shows the product family.

**Campaign name / description**

> AICHEETAH IO LLC dba Worxel (worxel.com) is the end brand and the only sender
> on this campaign — we are not a reseller, ISV, or messaging provider for other
> brands, and no third party sends on this number. Worxel operates Lift
> (lift.worxel.com), our own auto-repair service platform. Worxel sends
> transactional messages from a single Worxel-owned number to vehicle owners who
> opted in, about work in progress on their vehicle at a partner repair shop:
> an estimate ready for their approval, repair status updates, vehicle ready for
> pickup, a payment request, and replies to questions the recipient starts.
> Every message identifies Worxel Lift as the sender. Transactional only — no
> marketing or promotional content. Consent is collected in person when the
> vehicle is dropped off for service.

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

> Consent is collected in person at the point of service, not by phone or web
> form. When a vehicle owner drops their vehicle off at a partner repair shop,
> counter staff asks for their mobile number to send text updates and reads the
> disclosure verbatim: "By providing your phone number, you agree to receive
> text messages from Worxel Lift about your repair order at [Shop Name].
> Message frequency varies. Message and data rates may apply. Reply STOP to opt
> out, HELP for help. Terms and privacy: lift.worxel.com/privacy." The recipient
> gives an explicit verbal yes before the number is entered. The Lift software
> then requires staff to confirm consent when saving the number ("By adding this
> number you confirm the customer agreed to receive service texts about their
> vehicle. Msg frequency varies, msg & data rates may apply. They can reply STOP
> to opt out, HELP for help.") and records the consent timestamp on the customer
> record (smsOptInAt). Worxel immediately sends a written confirmation text
> identifying itself as the sender: "[Shop Name] via Worxel Lift: You're set to
> get text updates about your vehicle. Msg frequency varies. Msg & data rates
> may apply. Reply HELP for help, STOP to cancel." STOP is honored automatically
> — Worxel suppresses all future messages to opted-out numbers in addition to
> carrier-level blocking; HELP returns support contact. Mobile information is
> never shared with third parties or affiliates for marketing purposes.

**Opt-in screenshot attachment:** screenshot of the Lift "New customer" form
(lift-app.worxel.com → Customers → Add customer) showing the phone field with
its consent disclosure text.

## Program messages

**Opt-in confirmation message** (carrier vetting requires the registered brand
name or DBA — "Worxel" — to appear literally in the opt-in and opt-out texts)

> [Shop name] via Worxel Lift: You're set to get text updates about your
> vehicle. Msg frequency varies. Msg & data rates may apply. Reply HELP for
> help, STOP to cancel.

**HELP response** (avoid "on behalf of your repair shop" — that phrasing echoes
the reseller/ISV framing that got round 1 rejected)

> Worxel Lift: service updates about your vehicle repair. Msg & data rates may
> apply. Email lift@worxel.com for help. Reply STOP to cancel.

**STOP response**

> Worxel Lift: You have been unsubscribed from repair updates and will receive
> no further messages. Reply START to resubscribe.

## Sample messages

1. > Mike's Auto via Worxel Lift: John — here's the estimate for your 1988
   > Ford Bronco: Brake pad replacement — $120.00, Tire balance and rotation —
   > $45.00. Total: $250.00. Review and approve:
   > https://lift-app.worxel.com/public/estimate/ivYKmzw_G-bx1IuU9XNtOJo_za0D3lsA
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
