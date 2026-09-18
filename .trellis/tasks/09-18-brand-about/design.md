# Design — Brand About

## Assets

- `public/brand/logo.svg` — simple geometric “light point” mark (circle + soft glow), brand color friendly on dark UI. Easy to swap later.
- Optional: reference same file from `index.html` favicon.

## Shell

- Wrap brand tile in `Link to="/about"`.
- Use `<img src="/brand/logo.svg" alt="小光点" />` inside the rounded brand button (keep size-10).
- Nav: `{ to: "/about", label: "关于", icon: Info }` at bottom of main nav or above import.

## About page

- `src/routes/_studio.about.tsx` + `AboutPage.tsx`
- Layout: max-width prose, large logo, titles, links (`<a>` external GitHub `rel="noreferrer"`), privacy bullets aligned with docs principles.

## Constants

- Optional `src/lib/brand.ts`: `PRODUCT_NAME_ZH`, `PRODUCT_NAME_EN`, `GITHUB_URL` for reuse.
