# Brand About page and logo

## Goal

Make **小光点 Cuepoint** brand unmistakable in the studio chrome, and add an **关于** page with product name, placeholder logo, GitHub link, and a clear **本地数据 / 隐私** statement.

## Confirmed facts

- Product names: 小光点 (CN), Cuepoint (EN); repo https://github.com/ROYIANS/Cuepoint
- Studio aside mark is abstract `StudioMark` with aria-label only — weak brand signal (`StudioShell.tsx`)
- `document.title` is already 小光点; no dedicated About route
- Local-first + BYOK + connectors keys not in ZIP (see `docs/`)

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Entry | Logo mark links to About; sidebar adds「关于」 |
| Route | `/about` under studio shell |
| Logo | Placeholder asset under `public/` (simple mark; replace later) |
| GitHub | Link to `https://github.com/ROYIANS/Cuepoint` |
| Privacy copy | Local Dexie; BYOK keys on device; no cloud user DB by default; project ZIP is user-controlled backup |

## Requirements

- **R1** Replace/enhance sidebar brand control: show logo image (or logo + short wordmark if space allows in 76px rail — prefer logo tile linking to `/about`).
- **R2** About page: hero brand (logo + 小光点 / Cuepoint), one-line product pitch, GitHub link, privacy/data section.
- **R3** Favicon / apple touch use same placeholder if easy (`index.html`).
- **R4** Copy in Chinese primary; Cuepoint as English name.

## Out of scope

- Final designed logo / brand guidelines PDF
- Marketing landing site
- Legal counsel–grade privacy policy (plain-language product notice is enough)

## Acceptance criteria

- [ ] From studio, user can open About via brand mark and/or「关于」nav.
- [ ] About shows logo, names, GitHub, privacy/local-data explanation.
- [ ] Placeholder logo file exists and is used in shell + About (+ favicon if touched).
- [ ] `pnpm lint` / `pnpm test` pass.
