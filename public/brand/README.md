# Cuepoint brand assets

Approved artwork updated on 2026-09-21. Preserve the supplied alpha channel,
star, spectral mountain, and reflection; do not reconstruct the mark.

- `logo.webp`: 1024 × 1024 symbol for application branding and agent avatars.
- `logo-16.png`, `logo-32.png`, `logo-256.png`: square PNG favicon variants.
- `logo-lockup.webp`: 1254 × 1254 artwork with the Chinese and English names,
  reserved for larger brand placements. Use the symbol for small UI placements.

WebP assets use quality 95; PNG variants use Lanczos resizing from the supplied
1024 × 1024 symbol. All assets preserve transparency and the original framing.

Application references live in `src/lib/brand.ts`; browser icon declarations
live in `index.html`. Update their version query together when replacing the
artwork so browsers request the new assets.
