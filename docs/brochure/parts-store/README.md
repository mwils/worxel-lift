# Lift parts-store counter card

A two-sided 4 × 9 inch take-away card for a parts-store counter or upright holder.
The existing Letter brochure remains a more detailed leave-behind after a conversation.

## Files

- **lift-parts-store-print.pdf**: two pages, front then back, exact 4 × 9 inch trim.
- **lift-parts-store-letter-2up.pdf**: two identical cards per Letter sheet, front/back.
- **proof-front.png / proof-back.png**: previews.
- **generate.py**: editable copy/layout and reproducible PDF generation.
- **qr-parts-store.png**: standalone QR; the PDF uses vector QR modules.

## Why this version

The existing brochure has a distinctive identity, a concrete job example, clear pricing,
and a useful personal contact. For an unattended counter, it asks for considerable reading.
The new card identifies shop owners immediately, leads with fewer interruptions, and
limits the front to three benefits. The QR opens the information page, so visitors can
see the product before deciding to register.

The back retains the personal contact from the existing brochure without implying that
Matthew personally handed over this card. It distinguishes reviewed messages from optional
automatic status replies. It avoids the old unverified 10-second response promise,
three-screen setup claim, and guaranteed paid-before-pickup outcome.

## Printing

Print the 4 × 9 PDF at actual size, full color, double-sided, heads aligned.
No bleed is required: the outer edge is white and content is inset at least 0.25 inch.
For an office proof, use the Letter two-up version at **100% / actual size**, portrait,
duplex **flip on long edge**. Cut at the guide marks to yield two cards.
Do not use “fit to page.”

Use a card stock supported by the printer. Ask the store whether a 4-inch-wide holder
fits its available counter space before ordering a larger batch. Start with a small batch.
Check a physical proof for legibility, front/back alignment, and QR scanning before printing more.

## Placement and conversation

With the owner's permission, place the cards where professional shop customers pick up
parts, with the headline visible. A holder keeps the pitch visible above the counter.

Suggested introduction to the store owner:

> I built a phone-based shop app for small independent mechanics. Could I leave a small
> stack here for shop owners to take? My contact information is on it, so questions come
> to me. I'll check back and keep it tidy.

If staff ask what to say:

> This is a shop app for estimates, customer texts, and payments. The details and the
> builder's number are on the card.

No store logo or endorsement is implied. Ask permission separately for any co-branding.

## Tracking

QR destination:

https://lift.worxel.com/?utm_source=parts-store&utm_medium=print&utm_campaign=counter-card&utm_content=qr

The existing landing-page trial links preserve inbound campaign parameters and replace
utm_content with the CTA position. The QR identifies this channel, not a specific store.
For multiple stores, create separate batches with different utm_campaign values and
regenerate the QR. Typed visits to the printed short URL will not carry this attribution.

Record placement date, cards supplied, replenishment, tagged visits, and trials where
attribution is available. Ask new customers how they found Lift. Cards taken alone are
not evidence of paying customers.

## Regeneration

Requires Python with reportlab, qrcode, pymupdf, and opencv-python-headless
(a compatible prebuilt version may be needed on older Python/macOS).
The generator uses macOS Arial fonts from /System/Library/Fonts/Supplemental.

Run: python generate.py

It exports both PDFs and previews, checks text safe bounds, checks page dimensions,
and decodes the QR from the rendered front. Physical print testing is still needed.
