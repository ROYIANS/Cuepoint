# Implementation plan: desktop release pipeline

Status: in progress. The user approved the final reviewed implementation plan on 2026-10-12 with “开始吧”; task activation and local implementation are authorized. Baseline main 92bb6d4120053453036fbdb1b3b8f23fb9c56385; active branch codex/desktop-release-pipeline. Remote push, tag creation, workflow dispatch, Release mutation and public publication remain outside this implementation authorization.

## Current gate status

Actual owner-activated run 38208372156, attempt 1, at 946664ab passed desktop
quality (3,960 tests); the separate same-source GHCR run 38207181705 also passed.
The native matrix reached new failures: both macOS normal frontend builds
exhausted the approximately 2 GiB V8 heap while rendering; Windows directory,
binary and media tests failed before an abnormal test-process exit. Linux was
owner-cancelled after reporting one failed SQLite test, with no preserved nested
stderr artifact. See `research/release-hosted-native-followup.md` and the original
digest-checked evidence. The current correction branch is
`codex/release-hosted-native-failures`. Bounded frontend build resources, verified
Windows directory authority/fixture teardown and nested diagnostic visibility
are the completed local correction units. Final verification of 1,016 frozen
inputs passes: Node24 ordinary suite 228 files/3,965 tests (existing seven skips),
real SQLite all 108 files/1,910 tests plus six native/five browser checks, all 95
registered tools and 49 native business tables/assertion anchors; types, root and
desktop quality, 64 release contracts and both product/frontend builds pass.
Unchanged Rust source retains both passing feature suites/Clippy/fmt/portable
evidence. The reached Agent continuation gate correction skips only already
terminal snapshot history; five fresh-authority/Stop regressions and an old-loop
negative control preserve the original 64-turn fixture and deadlines. See
`research/release-hosted-final-validation.md` and the independent check. The
Linux cause remains unknown; source fixes and local gates cannot close H1a/H1b
or certify corresponding-host installers. A concrete grouped local commit plan
still requires review; no remote mutation or archival is included.

The next owner-supplied root CI log reached a new timeout in the exact 32 MiB
MiMo speech envelope acceptance test at the unchanged default 5-second deadline.
The minimal decoder copy correction is locally validated: both complete
Node22/Node24 root suites, actual SQLite all, types/quality/self-test/model/build
pass on 1,058 frozen inputs. The original boundary fixture/deadline is unchanged.
See `research/ci-mimo-boundary-followup.md`; previous passes below describe their
earlier checkpoints. Hosted success and H1a/H1b remain unverified.

The owner then supplied two additional reached hosted quality failures: the
desktop Knip graph misses real root-script export callers, and one unchanged
oversized-identity SQLite regression exceeds its 30-second deadline. Both are
locally corrected and verified under the existing task; see
`research/ci-quality-followup.md`. Final full ordinary/native suites and required
quality/type/model/build checks pass on frozen source. The initial unrelated
local Agent timeout and justified unchanged complete recheck remain recorded.
No hosted rerun or cross-platform outcome is implied by local correction.

After C0/main integration, the owner supplied a reached hosted quality failure
from the absent no-GUI `product_store_probe`. The correction is scoped to shared
probe preparation and both full-root-test quality jobs, with all native tests
preserved. Local red/green evidence and independent review are tracked in
research/ci-probe-readiness.md and research/ci-probe-check.md; subsequent hosted
execution is still pending. The C0 status below describes the earlier checkpoint.

Local source implementation and independent pipeline/native review are complete.
Root/desktop quality, release failure contracts, both frozen Rust feature lanes
and the frozen full shared SQLite business/Agent suite pass. The current local
Mac candidate native Save, source removal, observed UI reopen and read-only
SQLite/managed-file proof also pass. A reached external row-key verifier defect
was corrected with production-encoded fixtures and 16 passing Python contracts;
no product or QA data was changed. See research/local-checks.md and
research/local-mac-candidate.md for the finite evidence and superseded attempts.

The owner approved the exact C0 grouped local commit plan with “行”. Native
and release pipeline work commits are recorded in task.json; this documentation
group records the checkpoint. H1a/H1b remain pending owner activation. The unchecked implementation acceptance items below
include actual corresponding-host outcomes; source completion does not mark
those outcomes passed. The task remains in progress and cannot be archived yet.

## Workstream dependencies and ownership

Keep one externally verifiable release task. Workstreams have explicit gates; branch/tree placement is not a dependency mechanism.

| Step | Depends on | Ownership / deliverable | Acceptance |
| --- | --- | --- | --- |
| P0 | Final planning approval | Root: validate manifests, branch, load specs, freeze baseline and dispatch with context | Planning/activation gate |
| W1 | P0; B1 portable tools before host execution | Native implementer: candidate Windows filesystem protocol/API spike, closed origin/profile helpers and fail-closed regression entrypoint | R1; real host feasibility stays pending until H1a |
| W2 | W1 reviewed source contract; host proof pending | Native implementer: candidate handle identity/reparse/link/barrier/recovery integration, retained callers and meaningful Rust regressions | R1; AC1,AC6 require H1a success |
| B1 | P0; no prior host-success assumption | Tooling implementer: portable tool/probe resolution, release policy/build, versions/branding/icons, per-target receipts | R2,R4,R6; Windows success requires H1a |
| V1 | W2+B1 | Runtime implementer: external Windows/Linux product UI/disk smoke, Mac artifact/launch strategy | R3,R7; AC3 |
| C1 | P0+B1 receipt contract; V1 required-check definitions | Pipeline implementer: collector/failure tests, draft-only publisher and Actions matrix | R3,R5; AC4 |
| Q1 | W2+B1+V1+C1 frozen | Independent Trellis check: source/spec/quality/integration/outcome review, fixes in assigned scope | R1-R7; AC6 |
| C0 | Q1 | Root: concrete grouped local work-commit plan and user review; retain active task | Phase3.4 work commits only; no push/archive |
| H1a | C0 approved work commits; owner exact bootstrap-branch push | Actual Windows feasibility plus all four-host build/check/installer execution; iterate source/tests on failures | AC1-AC3; no draft-complete state while pending |
| H1b | H1a successful on frozen source; owner version-tag activation | Real tag-triggered collector/draft integration and asset/retry evidence | AC4-AC5; pending until run |
| F1 | Q1+H1a+H1b required gates | Root: spec sync, concrete file/commit plan, user commit review and archive/journal | Project Phase3 rules |

At most three implementers run concurrently in addition to root. Explicitly assign disjoint files, tell each worker they are not alone and not to revert peers, and coordinate shared Cargo/tools/receipt edits sequentially. Native Codex context injection is preferred; child-side reading of both manifest entries and PRD/design/implement is the required fallback. Root owns plans/specs/task metadata/commit coordination. No implement/check dispatch before final approval.

## P0: activation and context

- [x] Present final PRD/design/implement summary, including test distribution, four targets, Windows filesystem gate and remaining manual/hosted limits; obtain a subsequent approval.
- [x] Run task.py validate; check both manifests contain real specs/research and all paths exist. Read trellis-before-dev and affected spec indexes before code.
- [x] Verify current clean source baseline except owned planning paths; create/check out codex/desktop-release-pipeline without losing user edits.
- [x] Run task.py start only after the review gate. Record final scope/signing decisions in task metadata.

## W1/W2: native platform readiness

- [ ] Prepare the candidate API/protocol spike and fail-closed corresponding-host tests using pinned stable Rust. Source integration follows the owner-approved Windows process-recovery contract (regular-file flushing and NTFS no-overwrite publication, with no sudden OS/power-loss namespace promise); Unix fsync remains unchanged. It is not an accepted Windows implementation until H1a.
- [ ] At H1a on actual Windows x64, validate the Win32 seam, local NTFS identity/link/reparse rules and real directory/publication operations without privilege escalation. Record raw API flags/results/errors and distinguish documented guarantees from exercised process-recovery proof. Failure returns to W1/W2 for investigation; the narrower first-test guarantee was explicitly reviewed and approved on 2026-10-12. Further changes still require concrete design review.
- [ ] Do not introduce unconditional sync success. Implement the reviewed named Windows process-only namespace validation and writable final-file flushing; preserve errors, intent/provenance and published warnings. Do not claim a Unix directory barrier, omit a required target or introduce a fallback.
- [ ] Centralize exact platform origin and reuse for navigation/trusted main/microphone/media; test spoofed hosts/schemes/paths/ports/userinfo/query and allowed hash routing.
- [ ] Retain Mac WK identity; add trusted Windows/Linux WebView data-directory isolation for fixed normal/reference/review identities.
- [ ] Introduce consistent no-follow-path/open-handle identity across paths.rs, workspace.rs Boundary, database.rs, product_binary.rs and retained import.rs callers. Pin direct Windows bindings and update Cargo.lock deliberately.
- [ ] Test root/database/writer replacement, same-size/mtime distinct files, hard links/sidecars, junction/reparse escapes, active lease ancestor replacement, interrupted stage/publication/claim recovery and post-publication export warning. Keep exact bytes/rows and failure reachability assertions.
- [ ] Update corresponding native contract specs after verified source behavior; do not change unrelated business/Agent/UI recipes or old-data compatibility.

## B1: portable normal packaging

- [ ] Use a closed shared four-target policy; validate source/version/host/target/bundle and tool executables before output.
- [ ] Preserve explicit approved local pnpm/tools. Add deliberate hosted tool mode and platform-aware probe output resolution, including .exe and target directories; adapt existing native runner/self-hosted probe helpers without weakening coverage.
- [ ] Build real normal root frontend, then Tauri product-sqlite only; keep acceptance/isolated wrappers and receipts independent.
- [ ] Align normal visible Cuepoint name/title, keep existing binary/identifier/version, reuse dark icons including ICO; synchronize wrapper discovery instead of leaving old Prototype paths.
- [ ] Generate fresh DMGs, NSIS EXE, AppImage and DEB. Verify WebView2 install policy, Linux WebKit/GStreamer media dependencies and macOS14/ad-hoc signature.
- [ ] Verify payload/architecture/profile/owner/public-command set; exclude test hooks, acceptance permissions, fixture assets, tool/evidence directories and local user data. Emit exact target receipt/checksums with sourceBefore=sourceAfter.

## V1: actual payload checks

- [ ] Pin external tauri-driver and resolve compatible Windows Edge/Linux WebKit driver; use Xvfb on Linux. Install/extract generated packages and verify actual launched payload identity.
- [ ] Drive existing project/material forms, import TXT larger than262144 bytes, preview known marker, close with observed process exit, remove original fixture and reopen. Then verify read-only SQLite rows/reference plus generated-file exact hash/bytes externally. Linux DEB and AppImage payloads each run this complete sequence with separate fresh runner-created state and format-specific reports; extracted AppImage proof does not claim FUSE/desktop-launch success.
- [ ] Capture finite screenshots/errors/reports and clean only runner-created processes/fixtures. Driver needs no embedded plugin/acceptance IPC or SQL seeding.
- [ ] Both Mac hosts verify mounted DMG/app architecture/icon/signature and bounded process launch; do not equate launch-only with UI/store success. Rerun available local actual normal Mac UI/save evidence with task-owned disposable fixtures.
- [ ] Keep Intel UI and hardware/system/provider/media gaps explicit. No microphone, printing or paid calls are required by the packaging gate; prior receipts are history, not current execution.

## C1: Actions, exact collection and draft delivery

- [ ] Add desktop-release.yml with pinned action SHAs/tool versions, dedicated desktop-v* and build-only manual mode; retain GHCR behavior. Bootstrap with a build-only push trigger restricted to the exact codex/desktop-release-pipeline branch. Manual dispatch requires the workflow on the default branch; do not claim a new development-branch-only workflow can be manually dispatched.
- [ ] Run frozen root/desktop installs and native dependencies. Quality precedes four native jobs; fail-fast:false retains diagnostics. Only final tag publisher receives contents:write.
- [ ] Target artifacts have explicit run/attempt IDs and receipts. Collect exactly four targets/five installer files; reject path escapes/links/stale or ambiguous payloads, wrong source/version/owner/check status, length/hash/architecture mismatch and unexpected files.
- [ ] Produce canonical SHA256SUMS/release-manifest; meaningful tests inject actual bad manifests/files, not only snapshots of implementation branches.
- [ ] Publisher validates existing tag, uses authenticated paginated draft lookup and owns an incomplete draft via source/tag/payload marker. Never publish, overwrite another release, move tags or modify published/immutable objects.
- [ ] Retry identical original assets safely; changed payload/unknown assets fail; verify complete remote set before completion marker. Test partial uploads, duplicate/published/unowned releases and retry conflicts with a controlled fake API; record real draft behavior only after H1b.
- [ ] Document non-atomic uploads, publication-after-completion, original artifact retention/expiry and source-fix/new-version behavior.

## Q1: validation commands and review

Use /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm explicitly on this Mac. Hosted equivalents are resolved/pinned by the reviewed tool mode. Do not run Codex Runtime pnpm or add unsupported shell interpolation.

```text
git diff --check
approved-pnpm lint
approved-pnpm quality
approved-pnpm quality:self-test
approved-pnpm test
approved-pnpm model-bank:verify
approved-pnpm build
approved-pnpm --dir desktop/tauri types
approved-pnpm --dir desktop/tauri lint
approved-pnpm --dir desktop/tauri quality
approved-pnpm --dir desktop/tauri test:parity
approved-pnpm --dir desktop/tauri test:native
approved-pnpm test:storage:native --evidence-dir <fresh-empty-dir> --suite all
native locked fmt/clippy checks appropriate to new Windows/platform modules
release policy/collector/publisher meaningful failure regressions
workflow YAML/action input checks
pre-C0 normal Mac candidate bundle + isolated shared SQLite UI/import/Save/reopen proof
H1a only (post-C0 clean owner-activated hosts): target release build + artifact verification + named payload smoke
```

Actual release/smoke helper command names are finalized in B1/V1 and documented in package scripts; placeholders above are not claims of existing executables. Run focused boundary/failure tests while developing, then one final full frozen-scope batch. Repeat only for new failures/source changes. Independently review origin, identity/recovery, tool mode, package isolation, receipt closure, collector ownership/retry and honest evidence labels. Passing local/mocked tests never closes corresponding-host/draft criteria.

## H1a/H1b/F1: activation, docs and finish

- [ ] Update root README and desktop README for full SQLite/files/shared UI, download/install baselines, security prompts, current tested limits and owner version/tag/manual steps; all new project docs are English.
- [ ] At C0, present the complete grouped local work-commit plan for user review and commit only after approval; keep the task active and do not archive/journal completion. Coordinate owner push of the exact bootstrap branch for H1a, which is build-only. Manual dispatch can be used only after the workflow exists on main. Never initiate remote push/tag/Release mutation solely because implementation was approved. Keep hosted gate pending until actual jobs return; source-level W1/W2 is not corresponding-host success.
- [ ] If H1a exposes Windows protocol, driver or other target failures, investigate/repair W1/W2/B1/V1 and repeat Q1 on changed source before another owner-activated run. H1b tag/draft delivery requires a fully passing frozen build-only payload/source, not a pending feasibility assumption.
- [ ] At H1a, root reviews the actual Linux AppImage's bundled media libraries and retained license notices against recorded package versions/provenance; keep this inventory pending until the actual payload exists. Declared GStreamer dependencies alone are not that inventory.
- [ ] Record all four target builds and required runtime/package checks, exact published-to-draft asset identities and incomplete/retry outcomes. If failure occurs, investigate with original diagnostics; do not clear it by dropping target/gate.
- [ ] Sync executable specs with verified source and explicit platform limits, obtain final independent check, inventory every modified path and present the Phase3.4 concrete grouped commit plan. Commit/archive/journal only per user authorization; do not push or publicly publish as part of finish.

## Risk / rollback points

- Windows storage/namespace certainty: candidate W1/W2 plus actual H1a proof is a hard technical gate. Hold the target on unresolved guarantees; no dummy identity or silent barrier no-op.
- Normal branding/tool refactor: retain acceptance/reference identities and receipt contracts. Roll back only owned edits if integration fails; preserve peer/user changes.
- Failed target/package smoke: no complete draft; retain diagnostics and fix source. Record unsupported/pending device behavior separately.
- Collector interrupted upload: keep incomplete owned draft and original immutable payload; exact resume or explicit new-version recovery, no clobber/tag rewrite.
- External activation unavailable: local work is reviewable, hosted/draft gates remain pending and task is not falsely archived as fully verified.
