# Settings checkpoint validation — 2026-10-14

Scope: inherited settings/update implementation, user-requested Codex settings styling, network-search icon and the Tavily autofill regression. Branch: `codex/desktop-settings-update`. Product checkpoint: `84bac7b1`. Shell/popup changes already belong to `5f70f81d` and are not repeated. This checkpoint covers source and browser behavior; native acceptance and release remain outstanding.

## Final quality gates

All commands used the machine executable `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm` with that Node directory prefixed to PATH. No dependency installation or Rust change was needed.

| Command | Final outcome |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm test` | 280 files passed, 1 skipped; 4655 tests passed, 7 skipped |
| `pnpm quality` | PASS: lint/architecture/unused; 0 static cycles; existing reviewed allowances remain visible |
| `pnpm quality:self-test` | PASS: 88 cases |
| `pnpm models-dev:verify` | PASS |
| `pnpm build` | PASS |
| `pnpm landing:budget` | PASS: first-screen JS 84.87 KiB gzip / 120 KiB; CSS 3.79 KiB / 15 KiB; 49 modules across 4 chunks; desktop output excludes landing |
| `pnpm --dir desktop/tauri types` | PASS |
| `pnpm --dir desktop/tauri lint` | PASS |
| `pnpm --dir desktop/tauri quality` | PASS |

The final gates ran after the last Tavily async-lifetime fix with source/test edits frozen. A SHA-256 inventory of all 47 changed source/script/test paths was taken before this run and checked before committing. An earlier quality attempt intentionally failed its input-stability guard while an agent was still editing; it was rerun against the final unchanged inputs and passed.

## Tests and independent review

Eight new settings suites cover search on actual metadata, device-setting defaults/illegal values/persistence, route and rail behavior, switch semantics, update result UI mapping, automatic-check interval/StrictMode, duplicate/cancel/unmount lifetimes, native-save outcomes, and storage loading/error states. The connection editor suite mounts real ReactDOM/Radix dialogs and executes actual event callbacks.

Autofill cases preserve dialog and input identity and the Tavily draft both after rendering and in the same turn as opening. Closing restores manual search. Pending writes cannot be dismissed before a busy rerender. A previous component's late save result cannot unlock a newly opened editor after navigation.

An independent `trellis-check` agent reviewed purpose restrictions/redirect provenance, exact-size and digest verification, cancellation/lifetime races, accessibility and narrow layouts. Corrected findings include forged initial CDN authorization, parser/stream bounds, StrictMode startup cancellation, ambiguous Mac architecture, published-file save warnings, and storage/preference error presentation. No confirmed functional issue remained in the agent's final review. Automated proof does not establish packaged reachability or system-dialog behavior.

## Browser render evidence

Built output served locally with Vite preview and exercised in headless Microsoft Edge through CDP, using a fresh temporary profile. All five sections were checked at 1280×800 and 390×800. Each has one h1, no extra page-header description and no document horizontal overflow. All titles have matching geometry per viewport: `(365, 93)` at 1280 wide and `(21, 69)` at 390 wide. The global hamburger computes to `none` / `flex` respectively.

Real DOM interactions checked keyword filtering (`主题` exposes the appearance row), no-match empty state, legacy `/connectors` replacement, network-search SVG, Tavily draft preservation after a simulated settings-search fill, Escape dismissal and manual search after closing. No runtime exceptions were captured. Public release metadata was intercepted with a 0.1.2 fixture; source version 0.1.3 correctly renders the higher-than-online result. This is deterministic UI proof, not a new live GitHub verification or a real password-manager acceptance run.

Ten viewport screenshots and the browser assertion result were saved to the temporary verification directory. General/connections/mobile screenshots are also copied to the session's visualization workspace for user review. They are not shipped with the application.

## Remaining acceptance

- User-installed Windows/macOS: topbar navigation visibility, the two previously obscured popup headers, settings layout and focus behavior in short/narrow windows.
- Real update requests, rate limiting, installer download, system Save dialog, cancellation and opening the release/install pages from the packaged application.
- Existing-workspace migration with `deviceSettings`, native CI builds and installation. The local machine has no Rust toolchain.
- Separately inspect the existing `desktop-v0.1.3` tag and complete the release process; no tag, merge or push is performed in this checkpoint.

The task remains `in_progress`; A6, A9c and A10 are not claimed complete.
