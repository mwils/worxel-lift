# Lift walk-in brochure

For unattended parts-store placement, use the [parts-store counter card](parts-store/README.md), which includes a compact print PDF and a two-up Letter proof.

Two-sided 8.5×11 handout for shop walk-ins. Copy: [`../BROCHURE_COPY.md`](../BROCHURE_COPY.md).

| File | What it is |
|---|---|
| `lift-brochure-print.pdf` | **The print file.** Two pages (front/back), exact Letter size, vector text with embedded fonts, no bleed needed (0.45" margins built in). Hand this to the print shop or duplex-print it. |
| `lift-walk-in-brochure.canvas.html` | The design canvas, local copy — open in a browser to view both artboards and export PNG/PDF. |
| `proof-front.png` / `proof-back.png` | 2× raster proofs for quick review. |
| `source/` | Design source (artboards, layout, images). Edit these + regenerate, or edit visually in the canvas link above. |
| `assets/` | Raw captured screenshots, mockups, QR codes, wordmarks (see its README). |

## Print spec

- **Stock:** uncoated text or light cover weight (70–80 lb text / 65 lb cover). Uncoated suits the newsprint look and takes pen notes.
- **Duplex:** long-edge binding (both sides read portrait).
- **Color:** full color; design uses cream `#f4eedf`, ink `#1a1714`, red `#c8261d`. If the shop prints on white stock instead of printing the cream flood, that's fine at draft quality — but the cream background is part of the look, so prefer printing it.
- **Before the full run:** print one proof, test-scan the QR (goes to the sign-in/trial page with `utm_source=brochure`), and check the red band doesn't smear on the chosen stock.

## Regenerating the PDF

The PDF is Chrome print output of the two artboards at Letter size. If copy or
images change: edit `source/*.dc.html`, then re-run the print step (Playwright
`page.pdf`, format Letter, printBackground, zero margins) against a page that
inlines both artboards with `@page { size: letter; margin: 0 }` and a page break
between them.
