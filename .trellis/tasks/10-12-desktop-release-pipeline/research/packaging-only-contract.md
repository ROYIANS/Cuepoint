# Packaging-only release receipts and collection

## Authorization and boundary

On 2026-10-12 the owner explicitly requested that desktop delivery only package
the software, because functional testing occurs before publication. The current
decision in PRD/design/implement and `packaging-only-boundary.md` supersedes the
previous desktop workflow test/smoke gates. Independent quality workflows and
standalone developer test tools remain separate.

This implementation owns four source files:

- `desktop/tauri/scripts/build-release.mjs`: successful locked normal-product
  builds now emit `state: packaged`, with empty `checks` and `evidenceFiles`.
  The output message states that no automated tests or runtime acceptance ran.
  The bundle-marker comment describes the built executable hash without claiming
  installed/extracted parity. Existing clean-source, native-host, version/tool,
  fresh-output, normal-frontend, feature and installer discovery checks remain.
- `desktop/tauri/scripts/release-artifacts.mjs`: the collector accepts packaged
  receipts only with exactly empty check/evidence arrays. The full verified
  path still requires each closed named passing check and its hashed evidence.
  Source/product/host/version/policy/run/attempt, asset hash/length, closed paths,
  exact four-target/five-installer closure and retry rules remain authoritative.
  Generated limitations derive from receipt states. Revalidation requires those
  exact limitations, so a changed manifest cannot claim tests passed. An explicit
  standalone finalize operation can seal a fresh packaged receipt only after
  copying and hashing complete actual check reports; empty reports fail without
  changing the receipt to verified.
- `desktop/tauri/scripts/release-pipeline.test.mjs`: actual filesystem collector
  and controlled publisher fixtures now default to package-only receipts. The
  checks cover five installers across four explicit target/attempt artifacts,
  empty testing claims, package checksum corruption, links/unknown files,
  malformed receipt arrays, invented/building states, fabricated passed checks,
  extra evidence, host/signing/source/version provenance and incomplete sets.
  Explicit verified fixtures retain failed/missing/duplicate/unknown checks and
  changed/missing evidence rejection. Publisher tests still exercise owned
  incomplete drafts, exact retries, pagination, changed/unknown assets, published
  and unowned rejection, and conservative lost-upload-reply reconciliation.
  Package-only limitations appear in generated draft notes.
- `desktop/tauri/scripts/logged-process.test.mjs`: only the workflow dependency
  assertion follows collection directly after build. All real subprocess output,
  error, signal, log failure and cancellation assertions remain unchanged.

`release-policy.mjs` is unchanged: its named required checks belong to the
explicit standalone verified lane. `publish-draft.mjs` is unchanged: it renders
the collector's limitations into the draft notes and retains exact-source tag,
ownership, payload and incomplete/complete behavior. No product, Agent, storage,
deadline, fixture workload or application compatibility code was changed here.
Workflow and user-doc edits are owned by the separate workflow implementer.

## Local verification

One sequential batch ran on the user's Node 24.11.0 and approved explicit pnpm
path (`pnpm 10.15.0`). Evidence is in
`research/logs/packaging-only-contract/checks.json` and its four command logs.

| Command | Outcome | Elapsed |
| --- | --- | --- |
| Approved pnpm `--dir desktop/tauri test:release` | 79 passed; zero failed/skipped | 1.116 s |
| Approved pnpm `--dir desktop/tauri types` | Exit 0 | 3.469 s |
| Approved pnpm `--dir desktop/tauri lint` | Exit 0 | 3.031 s |
| Approved pnpm `--dir desktop/tauri quality` | Exit 0 | 0.662 s |

The recorded 31 script/workflow/support inputs have identical before/after
SHA-256 maps. These local checks verify the implementation change; the new
desktop packaging workflow does not execute them. No duplicate heavy suite or
unchanged test retry was used.

## Evidence limits and follow-up

Fixture installers and the controlled GitHub API establish collector/publisher
contracts, not actual OS packages or a remote Release. No expensive package
build, installed-product launch, full SQLite/Agent suite, Rust test, hosted
dispatch, tag, push or real Release mutation ran in this subtask. Native build
host/target metadata and recorded executable/frontend hashes do not prove every
installed payload's architecture or runtime behavior. Public publication remains
owner-controlled. The previously observed 64-turn native Agent timeout is
unresolved; this change removes it from desktop packaging rather than claiming
a performance fix. Real four-target package creation/collection and tag-owned
draft delivery still need the owner's subsequent hosted run.
