# Social card source

`landing-og.html` is the source for `public/social/landing-og-1200x630.png`.
Render it at exactly 1200×630 in headless Chrome and overwrite the PNG:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --hide-scrollbars --window-size=1200,630 \
  --screenshot="$PWD/public/social/landing-og-1200x630.png" \
  "file://$PWD/scripts/social/landing-og.html"
```

Fonts load from Google Fonts, so render with network access. Keep the card's
message in step with the hero in `src/Landing.tsx` — the brief positions Lift
as simple shop management, and the card shows the job board, not a text thread.
