# Actual hosted native-check follow-up

## Observed source and scope

The owner supplied failed platform wrapper output for GitHub Actions run
38208372156, attempt 1, source 946664ab235e0996da138796bd7d364381dab6ab.
The desktop quality job passed 3,960 tests. The separate GHCR workflow for the
same source also passed. This follow-up remains in the existing release task;
actual installers and draft delivery are still pending.

Original run/jobs/artifact API metadata and downloaded ZIPs are retained in
`logs/release-hosted-original/`. Each downloaded ZIP is checked against the
GitHub artifact digest before extraction. Both macOS frontend logs show Vite
transforming 13,195 modules, then exhausting the approximately 2 GiB V8 heap
while rendering chunks. Windows `native-3.log` records failures in directory
guards, product binary tests and media tests; the Rust test process terminates
with 0xc0000409 before printing individual panic details. Source review verifies insufficient metadata-only directory sharing authority
and fixtures deleting roots with live SQLite connections; no individual hosted
panic message proves which assertion each failure reached. Linux was
cancelled by the owner; its summary reports one failed SQLite test before
cancellation. The original complete workflow log archive has now been retrieved: Linux step10
contains only start and cancellation because nested child output was redirected
to runner files. No Linux diagnostic artifact was uploaded. The exact failing
test remains unknown.

## Smallest behavior gaps and intended owners

- The shared desktop frontend build entry must receive a sufficient, bounded
  Node heap budget under all existing callers. The budget belongs to the
  frontend entry, not global CI or every test process. The proposed boundary is
  `desktop/tauri/scripts/build-frontend.mjs`, a worker containing its existing
  unchanged Vite configuration, and meaningful child-process regressions. All
  current normal/acceptance entry points must retain argument and environment
  handling, output locations and failure propagation.
- Native fixture teardown must release owned SQLite connections and file/directory
  guards before recursively deleting its temporary directory. Exact changes are
  gated on the Windows investigation. Production no-overwrite, containment,
  identity and durability assertions stay authoritative.
- The Linux SQLite failure must be identified before defining a correction.
- The check wrapper currently redirects all child output to evidence logs and
  exposes only a file name on failure. If revised, diagnostics must retain the
  exact original log and exit failure, with bounded useful output rather than
  changing checks or retrying mutations.

No dependency upgrade, route/UI redesign, storage migration, synchronization,
removed platform, relaxed assertion or global test deadline is included.
No push, tag, hosted dispatch, release mutation or task archival is included.
Implementation and independent review agents receive explicit file ownership;
root owns task metadata, specs and Git.

## Validation intent

Measure the actual normal frontend build under Node 24 with the selected budget,
retaining duration and memory evidence. Verify child argument/environment/exit
behavior without a shell and ensure the existing acceptance lane remains
separate. Run the required desktop quality/release checks and affected Rust
feature suites. Any local macOS evidence must be labelled as such; real Windows,
macOS Intel and Linux reruns remain hosted acceptance gates. Record the precise
Linux limitation if cancellation prevented its original detailed evidence.


## Implemented candidate and measured results

The frontend launcher now owns an explicit 4096 MiB old-space child budget; its
Vite worker is byte-identical to the original builder. Actual local normal build:
31.01 seconds, peak RSS 2,585,460,736 bytes, 526 unchanged inputs. Acceptance build:
3.53 seconds, peak RSS 845,594,624 bytes, 543 unchanged inputs. Eight real launcher
contracts and desktop types/lint/Knip pass. These are local ARM64 results, not a
claim of hosted macOS Intel/ARM64 acceptance or a total-process memory ceiling.

Windows source now requests directory-list access only for pinned guards, with
original identity/NTFS/no-follow checks. The original ancestor rename test stays;
a new Windows-only DELETE-open/release test is added. Binary/media test fixtures
explicitly release preview/file/SQLite owners before directory deletion and keep
normal cleanup errors failing while preserving an existing panic. Forty-five
local distinct Rust cases pass. Only the Darwin target is installed locally;
Windows compilation and behavior still need the corresponding-host rerun.

Live nested stdout/stderr plus original per-command log retention, uncaptured
Rust diagnostics and cancellation artifact preservation pass their local
contracts. Frozen full Rust/browser/native/quality checks pass; see
`release-hosted-final-validation.md`. No assertion, boundary workload or deadline
has been relaxed. Corresponding-host jobs and installer delivery remain pending.

## Reached full-gate Agent cost correction

The ordinary full suite hit an unchanged 64-tool/32-request-segment case at its
original 5-second deadline (3,959 passes, one failure); SQLite all hit the same
case at its original 20-second deadline (1,904 passes, one failure). Focused
unchanged cases pass: ordinary full fixture2.17s and SQLite case16.529s. Prior
research records5,426 point reads and a matching16s focused lifecycle. All Agent
source/test/adapter inputs match the prior passing checkpoint. Repeating full
gates until one happens to pass would leave the measured marginal cost intact.

The smallest candidate is `src/lib/agent/runChat.ts`'s second execution pass:
after the abort check, skip snapshot calls already completed/failed/rejected.
The first validation pass already skips those states; current legal commands
do not reverse terminal calls. Keep all nonterminal fresh reads, current-run,
metadata/permission and atomic pending/approved claim checks, completed-result
lookups and unknown certainty. This removes2,112 unnecessary history point
reads from the exact64-turn/resume fixture. The generic transition helper does
not itself enforce a global status graph; illegal direct row mutations are not
supported and must not be described as impossible at storage level.

Additional ownership is limited to that loop, meaningful Agent test regressions
and finite matched profiling. Nonterminal snapshots must still be freshly checked
before dispatch; validation-failed or externally settled candidates cannot replay,
and Stop remains authoritative. Keep all existing workload/deadline assertions,
update the Agent execution spec and independent review, then repeat relevant final
gates on frozen source. This is a reached local prerequisite correction; the
unidentified original Linux failure is not assumed to be this case.

The candidate has now passed all final sequential commands with 1,016 unchanged
inputs: ordinary 3,965 tests, actual SQLite 1,910 plus six native/five browser
capability cases, 95 registered tool outcome coverage and all 49 table/business
assertion anchors. Types/quality/release64 and actual normal/acceptance builds
pass. Five new meaningful Agent cases pass on both owners; actual old-loop
negative control fails six reads versus three. Matched profiling removes exactly
2,112 reads but measures only about 4% elapsed improvement, without fabricated
phase timing. The original full failures are retained separately.

Four oversized original acceptance/coverage JSON files are packaged as
byte-exact `.json.gz` evidence. The deterministic compression manifest in
`logs/release-hosted-evidence-compression.json` records raw/compressed paths,
sizes and SHA256; no event, failure or assertion is omitted. Current local source
correction is ready for concrete commit review, not hosted acceptance or archival.
