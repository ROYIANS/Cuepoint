# Independent Release Upload HTTP Review — 2026-10-12

## Result and scope

No source issue remains in the reviewed repair. The reached defect is an upload
adapter framing gap: Node fetch receives a file stream without a known length,
while GitHub requires the release asset's `Content-Length`. The official
[release-assets contract](https://docs.github.com/en/rest/releases/assets#upload-a-release-asset)
also requires raw binary content. The old remote response body was not inspected;
local reproduction identifies a real defect without claiming that body was read.

Review used the task requirements/design/implementation, latest upload boundary,
distribution contract, retention rule, current adapter and actual HTTP tests.
Only the upload adapter and focused regression file change product tooling. This
review made no source fix and owns only this concise Markdown conclusion.

## Independent source and regression assessment

- One opened FileHandle supplies both `stat().size` and the streamed bytes.
  There is no separate pathname stat/read race introduced by the repair and no
  whole-file memory load. The binary body declares that exact length, retaining
  `application/octet-stream`, authentication/API-version headers and `duplex: half`.
- The existing HTTPS/host trust check still precedes transmission. A `finally`
  destroys an instantiated stream and awaits handle closure after success,
  HTTP rejection, transport rejection or URL rejection; stat failure also closes
  the opened handle. Missing-file failure occurs before any network call.
- Eight meaningful regressions use real Node fetch and a loopback HTTP server,
  not a fake high-level `upload` result. The retained former-body negative control
  observes absent length, chunked transfer, complete 150,003 binary bytes and
  HTTP400. The actual adapter positive case requires explicit length, absent
  chunking, full multichunk byte parity and an encoded asset name. Empty-file,
  missing-file, early HTTP400 and actual socket-disconnect cases cover errors
  and closed descriptors. JSON, no-content and binary-download paths remain.
- Independent byte comparison confirms all publisher protocol functions from
  pagination onward and the binary-download body equal HEAD. Draft ownership,
  existing tag/source/payload checks, no-overwrite behavior, exact interrupted
  upload reconciliation and complete marking therefore stay unchanged.
  The workflow, GHCR, release policy and artifact verifier also equal HEAD.
  No tests were added to packaging CI and no version, tag or remote object changed.

## Frozen verification

The implementer's compact report records actual local Node24.11.0/approved-pnpm
results: focused HTTP regressions 8/8; complete desktop release suite 92/92 with
zero failure/skip/cancellation; desktop types, lint and Knip exit0. These outcomes
were reconciled with the frozen files rather than repeating unrelated broad
gates. The reviewer independently checked the final hashes, unchanged protocol/
workflow boundaries and full `git diff --check` (exit0).

```text
1a3ec5d924d68db1eebe95fd5cadf2afe5a0f451342329d8a92825e683c3a331  desktop/tauri/scripts/publish-draft.mjs
23e3ddb3239c99cd64839f19f8a3129945db42ff22f6bcb3d5a1bd4f7ea4fd01  desktop/tauri/scripts/publish-draft-http.test.mjs
```

Lint: pass. TypeCheck: pass. Release tests: pass. No issue required a reviewer fix.
No raw logs, JSON evidence or copied workspaces were added to Trellis.

## Unperformed delivery and recovery

No GitHub upload, authenticated draft inspection, installer rebuild, workflow
dispatch or public publication was performed by this review. Local HTTP proof
does not establish hosted upload success. The existing successful tag run's
original artifact set may be resumed only after owner authorization and exact
original tag/source/payload validation. Rerunning that old workflow executes its
old source; a later adapter repair is not silently included. Unknown or changed
remote assets still stop for owner recovery. The task remains active until actual
draft delivery has an observed outcome.
