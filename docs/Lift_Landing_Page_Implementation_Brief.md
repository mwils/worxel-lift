# Lift Landing Page Repositioning and Implementation Brief

## Your role

Act as a senior conversion-focused product designer, UX writer, and front-end engineer. Update the existing Lift landing page rather than rebuilding it from scratch.

Live page: `https://lift.worxel.com/`

Inspect the existing implementation and reuse its established components, responsive system, typography, colors, patterns, and analytics where practical. Implement the changes, verify the result at desktop and mobile widths, and report the files changed and any assumptions made.

## Product and audience

Lift is simple shop-management software for owner-operated, 1-3 bay independent automotive repair shops.

The ideal customer is "Mike":

- Mike owns a small independent repair shop.
- He is the owner, technician, and service advisor.
- He spends most of his day working on vehicles rather than sitting at a desk.
- Repair orders may currently live on paper, a whiteboard, in Notes, or in his head.
- He needs repair orders, estimates, approvals, job tracking, invoices, payments, customers, vehicles, and repair history in one uncomplicated system.
- Larger products such as Shopmonkey and AutoLeap feel too expensive or too complex for his operation.
- He wants something that works well from the phone already in his pocket.

## Positioning decision

The primary value proposition is **simple shop management**.

Voice-to-RO is a useful differentiating feature, but it is not the product category or primary promise. Customer texting is a transactional mechanism for estimates, approvals, invoices, and payment links; Lift should not imply that it replaces the shop owner's existing phone number or becomes the customer's main communication channel.

Use this statement as the governing rule for the entire page:

> Lift is simple shop-management software for owner-operated 1-3 bay repair shops. Voice-to-RO, customer approvals, and payment links are features that make shop management easier; none of them should individually define the product.

## Preserve the existing brand

Keep the current:

- Cream, black, and red palette
- Editorial/industrial "shop manual" aesthetic
- Archivo Black, Spectral, and Space Mono typography
- Square corners, rules, numbering, and print-inspired details
- Direct and plainspoken voice
- Honest product-fit language
- Current masthead date behavior
- Existing routes, signup flow, and functional links

Do not turn the page into a generic SaaS design. Do not add gradients, glass effects, rounded card systems, stock mechanic photographs, vague claims, or corporate jargon.

## Primary messaging hierarchy

The page should communicate these ideas in this order:

1. Lift is simple shop-management software.
2. It is built specifically for owner-operated 1-3 bay shops.
3. It manages the complete job from repair order through payment.
4. It works well from a phone.
5. Voice entry makes creating repair orders faster.
6. Customer messages help complete specific transactions: estimate, approval, invoice, and payment.

## Remove or de-emphasize

Remove the following ideas from primary messaging, visuals, metadata, structured data, pricing highlights, and FAQs:

- "AI handles your customer texts."
- "Less phone tag."
- Automatic answers to "Is my car ready?"
- Claims that Lift replaces normal customer calls or texts
- Claims that the owner's phone will stop buzzing
- Auto-reply and kill-switch messaging as major benefits
- "Unlimited AI-drafted messages" as a featured pricing benefit
- Any implication that customers will stop using the owner's existing phone number

If automatic status replies remain available in the product, omit them from the main sales narrative. They may be mentioned later in secondary documentation, but they should not define the landing page.

## Page architecture

Reorder and shorten the page to approximately this structure:

1. Masthead and navigation
2. Hero: simple shop management
3. Product proof/dashboard visual
4. One job from write-up to paid
5. Pricing
6. Three grouped capability sections
7. Ideal-customer fit
8. Founder credibility or real customer proof
9. FAQ
10. Final CTA

The existing page is visually strong but too long. Reduce its total length by approximately 25-30 percent. Remove redundant explanations and tighten excessive vertical whitespace, especially between the workflow CTA and the customer-fit section.

## Hero

### Eyebrow

> FOR 1-3 BAY INDEPENDENT SHOPS

### Headline

> SIMPLE SHOP MANAGEMENT  
> FOR PEOPLE WHO STILL  
> TURN WRENCHES.

Use line breaks responsively. The headline should remain compact and readable at common phone widths rather than being forced into the exact desktop line breaks.

### Supporting copy

> Repair orders, estimates, approvals, job tracking, invoices, and payments—all in one straightforward app that works from your phone.

### Primary CTA

> TRY IT ON ONE RO →

### Secondary CTA

> SEE HOW LIFT WORKS ↓

### Trust line

> 14 days free · No credit card · $79/month flat

Use the same primary CTA wording throughout the page. Avoid rotating between "Try it free," "Start my free trial," and other generic labels.

### Hero layout

On desktop, retain a roughly 55/45 split between the copy and product visual. On mobile, place the copy and primary CTA first, followed by the visual. Make the primary CTA full width or nearly full width on narrow screens.

Do not use a customer-text conversation as the hero visual. It makes Lift look like a texting product.

## Hero product visual

Show the shop-management view or dashboard as the main visual. Mike should immediately understand that Lift helps him see and manage the day's work.

Prefer an actual Lift interface showing multiple jobs in recognizable states such as:

- Awaiting approval
- Scheduled
- In repair
- Ready for pickup
- Paid

Where appropriate, include the customer, vehicle, job total, and current status. Small supporting details may show an estimate approval or payment, but customer messaging must not dominate the visual.

Avoid tiny full-screen screenshots that become illegible on mobile. Crop visuals to the exact interaction being explained.

## Supporting statement

Replace "Less phone tag. More wrench time." with:

> LESS PAPERWORK. MORE WRENCH TIME.

Supporting copy:

> Lift handles the write-up and keeps every job organized, so you spend less time at a desk and more time doing the work.

## Workflow section

### Heading

> ONE JOB. FROM WRITE-UP TO PAID.

Use four concise steps. A visitor should understand the workflow by reading only the four headings.

### 01 — Create the repair order

> Add the customer, vehicle, work, parts, labor, and photos from your phone. Use saved jobs or talk through what you found when that is faster.

### 02 — Review and send the estimate

> Check the work, make any changes, and send it to the customer. They review the estimate and tap once to approve.

### 03 — Keep every job moving

> One board shows what is awaiting approval, scheduled, in repair, ready for pickup, or paid. No paper pile and no guessing where a job stands.

### 04 — Invoice and collect payment

> When the work is finished, send the invoice and payment link by text. The invoice and payment stay attached to the repair order.

Remove the existing automatic status-response step.

## Pricing

Move the pricing section immediately after the workflow. Price simplicity is a central selling point for this customer.

### Heading

> ONE SHOP. ONE PRICE. $79/MONTH.

### Supporting copy

> Repair orders, job tracking, estimates, approvals, invoices, and payments in one simple plan.

### Included features

- Unlimited repair orders, customers, vehicles, and photos
- Voice-assisted repair-order creation
- Estimate and approval links
- Invoices and customer payment links
- Complete vehicle and repair history
- One-click CSV export
- No per-tech or per-RO fees
- No add-ons or contract

Include an accurate payment-processing disclosure, such as:

> Standard Stripe processing fees apply.

Replace "Unlimited AI-drafted customer messages" with a factual transactional benefit such as:

> Estimate, approval, invoice, and payment messages included

Use the primary CTA below pricing:

> TRY IT ON ONE RO →

With supporting text:

> Free for 14 days. No card required.

## Capability sections

Replace the current nine equal-weight feature cards with three outcome-based groups. Individual capabilities may appear as concise rows or compact cards inside each group.

### WRITE IT UP

- Repair orders from your phone
- Parts and labor line items
- Voice-to-RO
- Saved common jobs
- Photo inspections

Give voice entry a distinct feature block here rather than using it as the overall product position.

#### Voice feature heading

> YOU TALK. LIFT WRITES IT UP.

#### Voice feature copy

> Walk around the vehicle and describe what you found. Lift turns it into editable parts and labor on the repair order.

### RUN THE DAY

- Simple job-status board
- Customers and vehicles
- Complete repair history
- Simple booking
- Vehicle-specific service reminders

### CLOSE THE JOB

- Texted estimates
- Customer approval links
- Invoices and payment links
- Secure card processing
- One-click data export

Transactional messaging belongs under "Close the Job." Do not present messaging as a separate customer-communication platform.

## Ideal-customer section

Replace the current equally weighted "for you/not for you" layout with a primarily positive section.

### Heading

> BUILT FOR THE OWNER WHO'S ALSO THE TECH.

### Supporting copy

> Lift fits best when you run a 1-3 bay shop, spend most of the day under a hood, and still have to write the ROs, track the jobs, send the invoices, and collect the payments.

### Fit indicators

- You operate a 1-3 bay independent shop.
- You write the repair orders and do the repair work.
- Your jobs currently live on paper, a whiteboard, in Notes, or in your head.
- You need something simpler than software built for large shops.
- You want the complete job, customer, vehicle, invoice, and payment history in one place.

### Concise exclusion statement

> **Probably not a fit:** multi-location shops, fleet-heavy operations, or shops with a full front-office team.

Remove the $1 million revenue cutoff, the phrase "real scheduling," and the recommendation to use a named competitor from this section. Do not give the negative section equal visual prominence.

## Founder credibility

If there is no approved real customer testimonial, add a founder section rather than inventing social proof.

### Heading

> BUILT BY SOMEONE WHO KNOWS BOTH SIDES.

### Copy

> I'm Matthew—a mechanic and software engineer. I built Lift for shops where the same person diagnoses the car, writes the estimate, tracks the work, and collects the payment.

> If something is broken or confusing, you'll reach me—not a call center or a ticket number.

Include Matthew's email and an approved dedicated business text number if available. Do not expose a personal number without explicit approval. Use a genuine, informal founder photo if an approved image exists; do not use an AI-generated or stock founder image.

If genuine customer proof is available, place one concise quote and concrete outcome immediately after the workflow. Do not fabricate testimonials, customer counts, or time-savings claims.

## FAQ

Keep the existing clean accordion design. Use questions that address adoption and operational concerns:

1. Will I waste my weekend setting it up?
2. Can I try Lift without moving my whole shop over?
3. Do I have to change my shop's phone number?
4. How do customer estimates and approvals work?
5. What payment-processing fees apply?
6. Does it sync with QuickBooks?
7. Can I take my data if I leave?
8. How is Lift different from Shopmonkey or AutoLeap?

Remove "Will my customers hate AI texts?"

### Suggested phone-number answer

> No. Keep using your existing number for calls and everyday customer conversations. Lift uses its messaging number to send estimates, approval links, invoices, and payment links connected to the repair order.

If the current implementation uses a shared Lift number, state that clearly and accurately. Do not imply that Lift takes over or ports the shop's existing number.

### Suggested trial answer

> Yes. Start with one repair order and keep using your current process while you test Lift. Add customers and vehicles as they come in.

Use this answer only if it accurately describes the product.

### Suggested competitor answer

> Shopmonkey and AutoLeap are designed for larger shops and more complex workflows. Lift is built for an owner-operated 1-3 bay shop that wants repair orders, job tracking, approvals, invoices, and payments without the extra complexity or price.

## Navigation and responsive behavior

Desktop navigation may include:

- How it works
- Features
- Pricing
- FAQ
- Sign in
- Try it on one RO

On mobile, prioritize:

- Lift logo
- Sign in
- Primary CTA
- Optional menu for secondary navigation

Move "Shop Notes" to the footer or mobile menu rather than allowing it to compete with the primary conversion path.

Consider a restrained mobile sticky CTA after the visitor scrolls beyond the hero:

> $79/MO · TRY ONE RO FREE

Only add it if it does not cover content or interfere with FAQ controls. Do not show it while the hero CTA is visible.

## Metadata and structured data

Update all metadata that currently positions Lift as an AI texting tool.

### Document title

> Lift — Simple Shop Management for 1-3 Bay Repair Shops

### Meta description

> Simple shop management for owner-operated repair shops. Create ROs, track jobs, send estimates for approval, invoice customers, and collect payment from your phone. $79/month.

### Open Graph title

> Simple Shop Management for People Who Still Turn Wrenches

### Open Graph description

> Repair orders, estimates, approvals, job tracking, invoices, and payments in one straightforward app for 1-3 bay shops.

Update the Open Graph image to show the job-management interface rather than a customer-text conversation.

Update SoftwareApplication and FAQ structured data so they exactly match the visible page. Remove automatic status-texting claims from structured data and descriptions.

## Analytics

Preserve existing analytics and add distinct events where practical for:

- Hero CTA clicked
- Workflow CTA clicked
- Pricing CTA clicked
- Final CTA clicked
- See how Lift works clicked
- Signup started
- Shop details completed
- First RO created
- First estimate sent

Preserve incoming UTM parameters through signup. The printed brochure may use parameters similar to:

`utm_source=donut_drop&utm_medium=print&utm_campaign=local_shop_outreach`

Treat "first RO created" or "first estimate sent" as a more meaningful activation event than a trial registration alone.

## Accessibility and performance

- Verify the result at common desktop, tablet, and mobile widths.
- Use responsive typography and prevent headline overflow.
- Maintain a minimum 44px tap target for primary interactive elements.
- Preserve visible keyboard focus states.
- Preserve reduced-motion behavior.
- Verify red/cream, black/cream, and reversed-text contrast.
- Do not shrink screenshots until their contents are unreadable.
- Lazy-load below-the-fold imagery.
- Preserve semantic heading order and one primary H1.
- Avoid cumulative layout shift by sizing imagery explicitly.

## Guardrails

Do not:

- Lead with AI, voice, or customer texting
- Describe Lift as an automated receptionist
- Claim that Lift replaces the shop's existing phone number
- Claim that customers will stop calling or texting the owner
- Hide the $79 price
- Invent testimonials or quantified outcomes
- Add enterprise features or enterprise language
- Redesign the established brand into generic SaaS styling
- Add stock photography
- Introduce several competing CTA labels
- Break existing signup, sign-in, blog, terms, privacy, or navigation routes

## Acceptance criteria

The implementation is complete when:

1. A first-time visitor can identify Lift as simple shop-management software without scrolling.
2. The hero communicates the target shop, core workflow, price, and trial terms.
3. The main hero visual communicates job management rather than customer texting.
4. Voice-to-RO appears as a supporting capability, not the main category.
5. Status-question auto-reply messaging is removed from primary copy and metadata.
6. Texting is described only in relation to estimates, approvals, invoices, and payments.
7. Pricing appears before the detailed feature catalog.
8. The feature catalog is grouped into Write It Up, Run the Day, and Close the Job.
9. The page is materially shorter and contains less redundant copy.
10. The layout works cleanly at desktop and mobile widths without clipped text, unreadable screenshots, or horizontal scrolling.
11. Existing functional routes and conversion flows continue to work.
12. Metadata and structured data match the revised visible positioning.

## Final implementation instruction

Make the changes directly in the existing landing-page code. Prefer editing and reusing current components over replacing the page wholesale. After implementation:

1. Run the project's existing formatter, type checker, tests, and production build.
2. Preview the page at desktop and mobile widths.
3. Verify all CTA targets and navigation anchors.
4. Verify there are no remaining primary references to automatic status-question replies.
5. Summarize the files changed, the major design decisions, and any product facts that still require confirmation.

