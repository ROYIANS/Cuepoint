# Release Asset Upload HTTP Implementation — 2026-10-12

## Reached defect and repair

The owner reported a completed package build followed by HTTP 400 at draft asset
upload. The previous `githubApi.upload` passed a file stream to Node fetch without
`Content-Length`; actual Node 24.11.0 sends that nonempty stream with chunked
transfer encoding. GitHub's documented release-asset upload contract requires
the byte length. This explains a concrete local framing defect; the exact remote
400 response body has not been inspected.

`publish-draft.mjs` now opens the upload file once, obtains its byte size from
that FileHandle and streams that same descriptor with explicit `Content-Length`.
The existing binary content type, token headers, HTTPS/host validation and
`duplex: half` remain. A `finally` destroys the stream and awaits descriptor
closure on success, HTTP rejection, transport rejection or URL rejection. Failure
still propagates; no retry, delete, clobber, timeout or logging policy was added.

Draft ownership, original tag/source/payload checks, exact remote-asset
reconciliation, incomplete/complete marking and owner-controlled publication
remain unchanged. The Actions packaging-only workflow is unchanged.

## Actual local proof

The new `publish-draft-http.test.mjs` drives the exported GitHub API adapter
through real Node fetch and a loopback HTTP server. The injected transport only
rewrites the already-validated GitHub URL to the local fixture; no real token,
GitHub request or remote write is used.

- Before repair, the positive nonempty adapter case received actual HTTP 400.
  The negative control retains the former request and demonstrates no length,
  `Transfer-Encoding: chunked`, and complete 150,003-byte binary parity. The
  initial red run was stopped after the old early-failure stream stayed open;
  it is not recorded as a completed gate.
- Corrected upload declares 150,003 bytes, omits chunked encoding and transfers
  every binary byte over multiple file-read chunks. The encoded Unicode/space/
  plus/hash asset name and existing auth/media/API-version headers remain exact.
- Empty-file upload declares zero and succeeds. A missing file rejects before
  HTTP. Early HTTP 400 and an actual socket disconnect reject and leave the file
  stream destroyed, closed and without an open descriptor.
- JSON POST, no-content JSON result, authenticated binary download and untrusted
  upload URL rejection retain their existing behavior.

Approved local Node and pnpm binaries were used with the Node directory first in
PATH. Final checks all exited 0:

| Check | Actual outcome |
| --- | --- |
| Focused HTTP regressions | 8 passed, 0 failed/skipped |
| `pnpm --dir desktop/tauri test:release` | 92 passed, 0 failed/skipped/canceled |
| Desktop `types` | Passed |
| Desktop `lint` | Passed, zero warnings |
| Desktop `quality` / Knip | Passed |
| Owned-source `git diff --check` | Passed |

## Frozen source

```text
1a3ec5d924d68db1eebe95fd5cadf2afe5a0f451342329d8a92825e683c3a331  desktop/tauri/scripts/publish-draft.mjs
23e3ddb3239c99cd64839f19f8a3129945db42ff22f6bcb3d5a1bd4f7ea4fd01  desktop/tauri/scripts/publish-draft-http.test.mjs
```

No installer was rebuilt; no version/tag was changed, no draft was deleted or
published, and no workflow was dispatched. These tests prove local HTTP framing
and resource behavior, not successful hosted GitHub asset upload. Actual recovery
must use the original verified artifact set with its original tag/source/payload
identity, or an explicitly selected new version. Raw fixture output remains
temporary and is not copied into Trellis.
