# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Quality gate is TypeScript build + Vitest. There is no ESLint config; `pnpm lint` runs `tsc -b`. Tests cover pure lib helpers and business command owners in `src/db/` with `fake-indexeddb`, not React component RTL.

---

## Commands

| Command | What it does |
| --- | --- |
| `pnpm lint` | `tsc -b --pretty false` (typecheck) |
| `pnpm test` | `vitest run` |
| `pnpm build` | `vite build` |
| `pnpm dev` | Vite dev server |

Vitest setup: `vitest.config.ts` aliases `@` → `src`; `tests/setup.ts` resets Dexie via `fake-indexeddb` each test.

---

## Required Patterns

- Durable mutations only through business command owners in `src/db/` (see the D02 map in state-management), `src/db/productionProposals.ts` and the `src/db/agent*.ts` repositories (`add*` / `patch*` / `delete*` / `set*Slot` / reorder helpers).
- Live reads with `useLiveQuery`; detail `get` queries use `?? null` (see hook-guidelines).
- Shot picture / generation data through `parseShotPictureSlots` / `parseGenerationSlot` so legacy fields stay readable.
- Filter, reorder, undo, draft, delivery, and shortcut-gating logic live in `src/lib/` and are shared — UI calls helpers, does not reimplement:
  - `shotFilters`, `reorderIds`, `undo`, `debouncedDraft`, `episodeDelivery`, `formFieldFocus`, `shotKeyboard`
- Studio asset create stays on studio routes with `STUDIO_LIBRARY_ID`; `touchProject` no-ops for the studio owner.
- Episode-scoped shot queries and delivery exports filter by both `projectId` and `episodeId`.
- Keyboard shortcuts call `isFormFieldTarget` before handling (`ShotEditorPage`).

---

## Forbidden Patterns

| Forbidden | Why / do this instead |
| --- | --- |
| Studio create → project picker or `/p/$projectId/...` | Navigate to `/characters\|scenes\|props\|styles/$id` |
| `useEffect` + one-shot `db.*.get` for live detail pages | `useLiveQuery` + `?? null` |
| Global Redux/Zustand/etc. for Dexie tables | `useLiveQuery` + repo mutations |
| Duplicating reorder/filter logic in the page | `reorderBeats` / `reorderShots` / shared filter helpers |
| Enabling export before live queries finish | Disable CSV/print until loaded (delivery-export) |
| Component RTL / Playwright as the default new test | Prefer `tests/*.test.ts` on lib + repo |
| Adding ESLint-only “fixes” without satisfying `tsc` | `pnpm lint` is the lint gate |
| `window.prompt` / `alert` / `confirm` | In-app `Dialog` (input) / `AlertDialog` (destructive) from `src/components/ui/` |
| `scrollIntoView({ behavior: "smooth" })` on Agent messages | `snapChatToBottom` on `.agent-message-list` (see chat-performance) |

---

## Testing Requirements

- Place tests under `tests/` as `*.test.ts`.
- Repo / IndexedDB behavior: use the shared setup that deletes and reopens `db` (`tests/setup.ts`, see `tests/repo.test.ts`).
- Pure helpers: unit-test without mounting React (`tests/undo.test.ts`, `debouncedDraft.test.ts`, `shotFilters.test.ts`, `formFieldFocus.test.ts`, `reorderIds.test.ts`, `episodeDelivery.test.ts`, `projectPackage.test.ts`).
- Cover invariants called out in other specs when touching those areas: studio `touchProject`, snapshot copy reject-on-duplicate, episode-scoped reorder ownership, delivery CSV quoting, form-field shortcut gating, agent chat `snapChatToBottom` / `CHAT_AT_BOTTOM_PX`.
- Do not require new component snapshot/RTL tests unless the change is untestable at the lib/repo layer.

---

## Accessibility and UX quality

- Keep focus-visible rings on interactive primitives (`src/components/ui/*`).
- Mark decorative motion/graphics `aria-hidden` (`ClickSpark`).
- Prefer Chinese user-facing strings consistent with existing pages (加载中…, 找不到…).
- Honor `prefers-reduced-motion` for decorative animation (`ClickSpark`, `src/styles.css`).

---

## Code Review Checklist

- [ ] `pnpm lint` and `pnpm test` pass for the change set
- [ ] Mutations go through their concrete business command owner; no ad-hoc `db.table.put` in components unless matching existing rare patterns
- [ ] Detail liveQuery uses `get(id) ?? null`; missing id shows 找不到, not infinite 加载中
- [ ] Studio vs project ownership and `back` discriminants are correct
- [ ] Shot/episode scoping preserved (filters, reorder, delete, delivery)
- [ ] Shared helpers reused for filter/reorder/draft/undo/shortcuts
- [ ] Types imported with `import type` where needed; domain types not duplicated
- [ ] New durable behavior has or updates a `tests/` case when logic is in lib/repo

---

## Examples

- Repo invariants: `tests/repo.test.ts`
- Shortcut gating helper: `src/lib/formFieldFocus.ts` + `tests/formFieldFocus.test.ts`
- Delivery pure logic: `src/lib/episodeDelivery.ts` + `tests/episodeDelivery.test.ts`
- Typecheck gate: `package.json` script `lint`

---

## Anti-patterns

- Treating “no ESLint” as no quality bar — unused locals/params and strict nulls still fail `tsc`.
- Adding a second state library “just for this page.”
- Copy-pasting reorder or filter code into `ShotEditorPage` instead of extending `src/lib/`.
- Shipping package-import changes without updating `tests/projectPackage.test.ts`.

---

## References

- `package.json` scripts
- `vitest.config.ts`, `tests/setup.ts`
- `src/db/projects.ts`, `episodes.ts`, `shots.ts`, `assets.ts`, `media.ts`, `assetReuse.ts`, `connectors.ts`, `chat.ts`, `cascadeCommands.ts`
- `src/lib/formFieldFocus.ts`, `reorderIds.ts`, `shotFilters.ts`, `episodeDelivery.ts`
- `.trellis/spec/frontend/hook-guidelines.md`, `state-management.md`, `delivery-export.md`

## Release gate

`.github/workflows/ghcr.yml` runs locked dependency installation, TypeScript, the full Vitest suite, model snapshot verification and a production build on main pull requests, main pushes, release tags and manual runs. The Docker publication job depends on successful quality checks; pull requests never publish images. Only the publication job has package write permission. The pnpm setup uses the version pinned by `package.json`.

## Optional analytics deployment

`VITE_UMAMI_SCRIPT_URL` and `VITE_UMAMI_WEBSITE_ID` are public build-time settings supplied by GitHub Actions repository variables. Keep the workflow's Vite build environment and Docker build arguments aligned. The Docker arguments belong only to the build stage; Compose and the Nginx runtime need no analytics environment variables. Local `.env` files are excluded from Git and Docker contexts, with `.env.example` as the documented template.

Initialize Umami once from `src/main.tsx` outside React lifecycles, only for production builds with both settings. Use the tracker’s own SPA pageviews; adding router listeners or manual pageview calls would duplicate visits. Analytics loading must not block React rendering. Do not attach project contents, prompts, or provider credentials to analytics events. Clearing configuration takes effect only after rebuilding and redeploying the image.


## Audit evidence contract (2026-09-30)

A full-source audit must maintain a fixed file manifest and an explicit review ledger.
Tool success, passing tests and long-file inspection alone do not establish full coverage.

- Manifest records `baseRevision`, every scoped path and its content `sha256`; detect source changes before finalizing findings.
- Per-file coverage uses `{ path, status, note, findings }`. Status is `reviewed`, `generated-verified`, or `blocked`; a blocked or missing file prevents a claim of complete coverage.
- Review ordinary code in full. For generated data/code, state the generator/source and exact verification performed; do not claim manual line review of generated JSON.
- Confirmed findings need location, triggering input/call sequence, mechanism, impact, recommendation and behavior validation. Label untested runtime/browser concerns as risk; structural debt alone does not prove a current failure.
- Separate type-only edges from value imports when reporting cycles. A cycle reporter may filter its first edge yet include type edges later in the path; validate the complete value cycle.
- Knip export/file candidates require entry-point, ambient declaration, CSS import and test-only usage checks. In this project `src/lib/references/mammoth.d.ts` contributes the declaration for the browser import and must not be removed solely because no runtime import points at it.
- React rule matches for ordinary business functions named `useX` require inspecting whether they actually call React Hooks; naming matches alone are not runtime Hook evidence.
- Clone/complexity counts are locating signals. Compare business contracts before consolidating retries, validators or CRUD; do not reduce complexity by removing safety checks or adding forwarding abstractions.
- Preserve raw commands, versions, exit status and diagnostics. JSON reporters can exit zero while their summary contains violations; inspect both.
- An audit report is not a product fix. State whether tools/rules were merely run, permanently configured, or connected to CI; recommendations do not imply adoption.

The 2026-09-30 source audit and proposed architecture/tool gates are recorded in
`.trellis/tasks/09-30-src-quality-architecture-audit/`. The existing project quality
commands above remain the installed gates until a subsequent implementation changes them.

## Durable original-source comparison fixtures (2026-10-08)

## 1. Scope / Trigger
Use this rule when a permanent regression compares current behavior with immutable original code captured during a task. Archiving task records must not remove test inputs or make tests write into archived directories.

## 2. Signatures / Owners
Permanent tests consume the minimal required original module closure under `tests/fixtures/sourceSnapshots/{d05,d06,d07}`. Preserve snapshot bytes and relative import hierarchy, with original-path/hash provenance. Task research/reviews remain immutable evidence, not runtime test dependencies.

## 3. Contracts / Invariants
Copy needed modules; do not move or edit historical evidence. Resolve relative imports within each snapshot closure. Existing alias imports and intentionally shared untouched dependencies retain their original comparator semantics. Tests remain read-only with respect to task reports. Remove a redundant report write only while keeping its behavioral assertions. Original-versus-current comparison must still execute real parsers/adapters, not canned expected outputs.

## 4. Validation / Error Matrix
| Condition | Required behavior |
| --- | --- |
| Active task folder unavailable after archive | Permanent regression still resolves and executes |
| Missing transitive snapshot import | Fail fixture completeness proof/test |
| Snapshot byte differs from recorded original | Fail provenance proof |
| Test writes task report | Remove side effect, retain asserted behavior |

## 5. Good / Base / Bad Cases
Base: stable test fixture imports with original bytes. Good: archive-unavailable execution verifies all affected comparisons. Bad: a permanent test imports an active dated task folder, rewrites accepted evidence, or relies on an assertion-free report generator.

## 6. Tests Required
Run affected original/current behavioral comparisons and demonstrate execution/resolution with the active task directory unavailable in an isolated environment. Verify the minimal relative import closure and original byte hashes; retain any failed attempt and state finite limits.

## 7. Migration / Limits
This correction preserves comparison semantics and evidence while making test inputs durable. It does not claim snapshot source satisfies current production rules, replace current production owners, or close E/QG01 debt. Archived native research scripts are historical evidence unless separately adopted as stable regression entry points.

## B01 native harness isolation and failure authority (2026-10-08)

### 1. Scope / Trigger
Maintain when changing the standalone B01 browser runner or its local Vite setup, particularly repeated runs across different fixture configurations.

### 2. Signatures / Owners
`scripts/b01-browser-regression.mjs` creates a fresh temporary `cacheDir`, explicitly scans the actual B01 fixture HTML via `optimizeDeps.entries`, and removes its cache after closing Vite. Main-frame document requests are counted; only initial fixture loading is allowed during the SPA regression sequence.

### 3. Contracts / Invariants
Keep every existing business assertion and timeout. Unexpected full-document reload is a failure, not authority to reinitialize fixtures, retry interactions, ignore missing bridge objects or increase waits. Cache separation is test isolation, not a product fix or proof of the original failure cause. Keep prior failures and configuration/runtime inputs.

### 4. Validation / Error Matrix
| Condition | Required result |
| --- | --- |
| Initial fixture document | One allowed main-frame document request |
| SPA route/history and dialogs | All existing assertions; no extra document request |
| Extra document navigation/reload | Explicit test failure |
| Consecutive cold runner instances | Separate temporary caches, same semantic assertions |

### 5. Good / Base / Bad Cases
Base: all19 scenarios pass from a fresh isolated cache. Good: an unexpected reload fails instead of silently recreating controls. Bad: calling a warm rerun proof that an unobserved root cause was fixed.

### 6. Tests Required
Preserve exact before/after assertion/timeout comparison and actual consecutive cold runs. Final current-source batch must include this runner. Retain failed logs and distinguish observed behavior from causal inference.

### 7. Migration / Limits
This scoped correction does not establish why earlier blank-page/bridge failures occurred; observational isolated and forced-cold shared controls both passed. It does not modify product behavior, install dependencies, migrate every other historical native program or close formal E/QG01 work. Local Chromium fixtures do not prove full-product or live-provider behavior.

## E07 formal source quality contract

Independent E07 integration accepted on 2026-10-09.

### 1. Scope / Trigger

All authored src changes and necessary regression runners/configuration use the root type check, formal quality CLI, meaningful tests and build/model gates. Imported vendor stays outside manual review but remains compiler/build input. Generated route is excluded from typed lint; generated icon data is included. SonarJS supplies local ESLint rules; no SonarQube service is required.

### 2. Signatures / Owners

`quality` runs `scripts/quality-check.mjs`; `quality:self-test` runs its actual CLI synthetic contracts. Root `eslint.config.mjs`, `knip.json`, pinned package/lock, exact `quality/debt.json` and `quality/unused-contracts.json` own policy. CI runs both commands before tests while retaining Node22, existing triggers, image publication and permissions. Local commands use the authorized explicit machine pnpm executable.

### 3. Contracts / Invariants

Typed recommended, Hook rules/dependencies, exhaustive switches and duplicated branches/conditions block new errors. Only individually reviewed error nodes with exact rule/file/parser tokens/semantic owner/count/reason may pass; producer hash and TypeScript version changes require review. Strict unknown/any throws fail; recognized caught rethrows and package-origin TanStack Redirect retain their contracts. Static value cycles and Domain→DB/UI or DB→UI value edges fail. Dynamic literal edges obey boundaries but do not create static cycles. Full-scope owned unused findings require precise retained API/import/declaration/runtime evidence. Any remaining nonzero Knip tool/config exit fails. Repair leaves stale debt/contracts until explicitly shrunk. Inline lint directives do not authorize exceptions.

### 4. Validation / Error Matrix

Mutation/owner transfer, changed multiplicity, duplicated JSON keys, stale removal, producer/evidence changes and unsupported tool outputs fail. Formatting/line relocation, exact parser tokens, type-only edges, supported retained APIs and caught error identity pass. Anonymous and named expression callback ownership binds actual call/new kind, optional call, argument role, other arguments, callback flavor/self-binding and control-flow owner. Indistinguishable callback/control boundaries cannot receive debt. Complexities, depth and nested ternary are visible review warnings; they cannot be baselined as debt.

### 5. Good / Base / Bad Cases

Good: narrow unknown values at actual boundaries and remove unused internal exports without changing bodies. Base: thirteen reviewed diagnostics preserve five sanitized wrappers, seven original failure/cancellation transports and one guarded every-render draft reconciliation. Seven unused contracts retain two stylesheet imports, one TypeScript companion declaration, two explicit native runtime/virtual imports and two documented audio deletion APIs without current UI callers. Bad: blanket ignores, automatic import of all baseline errors, every-src-as-entry reachability, arbitrary test deletion or assertions that hide unsafe inputs.

### 6. Required Tests

Actual production CLI must reject sibling callback and branch debt transfers, support formatting/recursion, detect stale/decreased debt and exact evidence changes, and preserve Knip exit authority. Accepted E07 runs 88 such cases. Run actual strict app types, full tests, model verification, build and Node22 fresh locked installation. Native draft test requires explicitly injected browser/runtime and proves stable primitive and memoized external values after in-flight persistence. Default CI skip is explicit; an opt-in acceptance run must prove execution. Current E07 exact local verification: 172 files/3028 tests, 419 owned graph files/1644 static value edges/6 literal dynamic edges, zero cycles/forbidden/unallowed findings, 512 visible review warnings. These are dated proof counts, not fixed acceptance thresholds.

### 7. Wrong vs Correct / Attribution and Limits

Wrong: zero warnings claim, counted unresolved historical metadata imports as repairs, normalized an unexplained tool exit into success, or treated source counts as user-visible performance. Correct: complete historical imported vendor/dependency closure, individual before/current rule interpretation, exact independent coverage, explicit generated-route token equivalence/restoration and real source hashes. Local macOS Node22 proof is not Linux GitHub execution; offline/generated-media native tests do not establish paid providers, mobile/device/OS scheduling, battery or latency behavior.
