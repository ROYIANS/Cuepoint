# Application and Package Boundaries

## 1. Scope / Trigger

Read when adding an application/library, changing package exports/dependencies, relocating source or editing workspace/build/quality discovery. This contract covers application separation; vertical Studio organization and reusable Agent extraction are later steps with their own accepted task contracts.

## 2. Signatures and Owners

| Owner | Responsibility and entry |
| --- | --- |
| `apps/web`, `@cuepoint/web` | Browser HTML, `src/main.tsx`, Vite configuration and package `dev`/`build`/`types`. |
| `apps/desktop`, `@cuepoint/desktop` | Native entry, Tauri/Rust, native/build/release scripts and explicitly retained reference lanes. |
| `apps/site`, `@cuepoint/site` | Landing HTML, site source/assets and standalone `dev`/`build`/`types`. |
| `packages/studio`, `@cuepoint/studio` | One shared product implementation; `./bootstrap` and `./styles.css` exports. |
| `packages/distribution`, `@cuepoint/distribution` | `./brand`, `./analytics`, `./releases`, `./platform`, `./version` and shared public brand assets. |
| Root `tooling`, `tests`, `quality`, `deploy` | Repository checks, integration fixtures, policy and assembled web/site delivery. |

Root remains the authoritative app release version; native version/integrity readers must agree. Private workspace manifests do not create independent app release streams. pnpm workspace declarations and package manifests define installation; the quality-owned source/dependency inventory must agree with actual packages.

Root `build` builds web/site and assembles `dist`; `dev` selects web, `dev:site` selects site. Existing root `lint`, `quality`, `quality:self-test`, `test`, `models-dev:verify`, `landing:budget` and native regression commands remain usable. Run package builds via the approved explicit pnpm path and `--filter @cuepoint/<app>`.

## 3. Contracts

- Apps are leaves. Web and desktop consume the same Studio bootstrap through declared exports. Studio never imports application source; the site consumes only its own modules, React and lightweight distribution exports.
- Declare internal dependencies using `workspace:*`. Cross-package consumers use actual export-map entries, never sibling source traversal or another package's private alias. Production Studio modules currently use package-local relative imports. Root integration/fixture resolution of `@/` targets Studio only and does not authorize production cross-package aliases.
- Retained native/reference harnesses may consume individually declared `./reference/...` Studio exports for existing behavior tests. They are deliberate current reference APIs, not wildcard access, a duplicate implementation or permanent old-path bridges. Normal product entries use bootstrap.
- Browser/native startup selects the fixed existing ProductStore before render. Keep schema bytes/identity, routes, protocol contracts, product transactions and managed-file behavior unchanged during relocation. Rust schema inclusion follows the one Studio schema owner.
- Distribution never imports Studio, application source, storage, Agent or native runtime. Installer verification/download/Save and device settings stay product-owned. Site budgets and dependency-closure checks cover both eager and lazy chunks.
- Web/site outputs use disjoint asset namespaces. Assembly accepts identical shared assets, rejects conflicting output/report keys and missing manifest/resource/module references, and validates before replacing deployment output. Preserve production site at `/`, app fallback elsewhere and private manifest denial.
- Register every app/library and owned source root in type/lint/architecture/unused/test discovery. Desktop scripts/UI/reference inputs retain their appropriate separate gates. A source relocation and its discovery/config/test updates are one implementation slice.
- Move input identities with execution scope. Quality/native freshness checks must include the actual desktop scripts/UI and package/build/check configurations they consume; a passing receipt must reject changes to those inputs during its run. Independently invoked Python/browser/type-check harnesses need the same relocation inventory as package scripts.
- Keep immutable comparator bytes. Review and rebind exact diagnostic/retained-API evidence individually; no ignored new package, broad allowance or all-source-as-entry trick may make the gate pass.
- Keep existing delivery policy and source/version/hash closure. Desktop hosted delivery remains packaging-only; separate quality/native checks remain independent. This structural change authorizes no push, hosted dispatch or public publication.

## 4. Validation and Error Matrix

| Condition | Required outcome |
| --- | --- |
| Actual workspace package missing from quality inventory | Fail source coverage before claiming graph success. |
| Registered owned source root absent or omitted from a check | Fail; nonzero total source count is insufficient. |
| A consumed source/configuration changes during a quality/native run | Reject the stale result; input identity follows actual check ownership. |
| Site imports Studio, directly or transitively | Fail source/built-closure checks. |
| Sibling application import, private source traversal or foreign alias | Fail package boundary checks, including type-only package bypasses. |
| New static value cycle or prohibited Studio domain/DB/UI edge | Fail architecture gate; literal dynamic edges obey boundaries too. |
| Output file/report conflict or unresolved manifest/resource edge | Fail assembly without replacing validated output with a partial build. |
| Current snapshot bytes or reviewed evidence identity changes | Fail provenance/quality until the exact change is reviewed. |
| Native executable/tool/host unavailable | Record the specific unmet prerequisite/check; never infer runtime acceptance from build success. |

## 5. Good, Base and Bad Cases

Good: add a package's real sources, exports and declared callers, update every discovery owner, then prove a forbidden edge still fails. Base: move a Studio module intact and update its exact imports/fixture seam without changing behavior. Bad: leave a root-src alias, mark every file as an entry to hide unused code, duplicate bootstrap, or suppress a native assertion because its executable moved.

## 6. Tests Required

- Full root types/formal quality/self-test/tests/model verification/build and site budget after final structural changes; retain the actual native probe prerequisite and shared real-store all-suite acceptance.
- All three per-app builds, desktop types/lint/unused/parity/native/release-tool checks, and current fixture/reference gates through their actual relocated owners.
- Meaningful negative cases: forbidden site/Studio and sibling-app edges, undeclared/private cross-package import, unregistered package/source root and missing source discovery. Verify the real gate rejects them, rather than merely testing a copied predicate.
- Assembly cases: both HTML entries and reports survive, references resolve, identical shared assets are accepted and differing files/report keys or missing resources fail.
- Check route refresh, workers/assets and normal available browser/desktop startup separately from unit/build proof. Other-OS, actual installer/Save/live-provider coverage remains bounded by observed execution.

## 7. Wrong Versus Correct

Wrong: `apps/site` imports `../../packages/studio/src/lib/...` or uses the Studio `@/` alias. Correct: site declares distribution as a workspace dependency and imports an explicitly exported lightweight module.

Wrong: build both applications into the same directory with cleaning disabled and assume merged output is valid. Correct: build separately, validate complete manifests/module/resource closure and collisions, then assemble the existing deployment layout.

Wrong: copy every canonical spec under each package. Correct: package indexes select shared canonical contracts; update source anchors when their real owner moves, and read long specs beyond automatic injection limits.
