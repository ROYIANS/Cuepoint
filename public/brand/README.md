# Cuepoint brand assets

Approved artwork updated on 2026-09-22. Preserve the supplied alpha channel,
star, spectral mountain, and reflection; do not reconstruct the mark.

- `logo.webp`: 1024 × 1024 symbol for application branding and agent avatars.
- `logo-16.png`, `logo-32.png`, `logo-256.png`: square PNG favicon variants.
- `logo-lockup.webp`: 1254 × 1254 artwork with the Chinese and English names,
  used on the About page and reserved for larger brand placements. Use the
  symbol for small UI placements.
- `sponsor-wechat.jpg`: user-supplied 1152 × 1152 appreciation-code artwork,
  preserved without modification. The About page displays it in a dialog and
  offers the original image for download; do not redraw or alter the code.

WebP assets use quality 95. The supplied 1254 × 1254 symbol is resized to
1024 × 1024 with Lanczos before deriving the PNG variants. All assets preserve
the supplied alpha channel and original framing. The About page places the
lockup on black to keep its partially transparent dark background uniform.

Application references live in `src/lib/brand.ts`; browser icon declarations
live in `index.html`. Update their version query together when replacing the
artwork so browsers request the new assets.
