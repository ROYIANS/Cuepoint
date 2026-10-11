# APIMart reference-upload fixture repair

Date: 2026-10-11. Scope: only `scripts/native-product-fixture.mjs`, its self-check,
and this diagnostic evidence. Product source, adapters, safety checks and packaged
applications remain unchanged.

## Observed boundary

The root's actual final-network application confirmed a two-item generation
batch at 18:17. Video submission, task query and result download succeeded. The
reference-image item failed with `APIMart 返回的数据格式不符合接口约定`.

The fixed fixture server records show:

- Request 47 at `2026-10-11T10:17:29.442Z` was native `POST /v1/uploads/images`
  with `tauri://localhost` origin and a WebKit multipart boundary.
- The server parsed the actual `image.png` file: 177 bytes and SHA-256
  `626815c78eaad46cad849732d1598b45b91700ce046c1ee3f4e2444db80aa32a`.
  Multipart framing made the complete request 359 bytes; those counts are
  different quantities.
- No corresponding image-generation POST followed that upload. The independently
  submitted video used request 48, was read in request 49 and downloaded without
  authorization/cookies in request 50.

This established that native multipart transport had reached the fixture; the
failure was in the synthetic upload response contract, before image submission.

## Root cause and repair

The unchanged product `uploadApimartImage` expects upload metadata at the top
level: `{url, filename, content_type, bytes, created_at}`. Unlike generation
submit/query APIs, uploads do not put those fields inside `data`. Existing
`tests/apimart.test.ts` explicitly rejects `{data:{url:...}}`.

The fixture incorrectly returned `{code:200,data:{url,...}}`; its old self-check
also read `.data.url` directly, so both shared the same incorrect assumption.
The fixture now returns the correct top-level metadata, preserves the uploaded
filename and reports the actual file byte count rather than multipart framing.
No alternate upload envelope was added to the product adapter.

The self-check loads the actual unchanged TypeScript APIMart adapter through the
existing Vite module loader. Real Node fetch exercises upload, reference image
submission, task query and unauthenticated output download; it verifies exact
returned filename/type/file bytes/72-hour expiry, binary hash and one submission.
A negative check wraps the real response in the old nested envelope and verifies
the product still rejects it with `kind: protocol` and only one upload request.

## Evidence

| File | Result | Meaning |
| --- | --- | --- |
| `apimart-upload-before-fix.log` | Exit 1, original protocol error | The new actual-adapter check reproduced the malformed old fixture |
| `apimart-upload-after-fix.log` | Exit 0, 17 checks pass | Correct upload/reference chain plus prior fixture checks and negative envelope guard |
| `apimart-upload-product-regression.log` | 1 file, 56 tests pass | Existing product APIMart contracts remain valid |
| Node syntax/whitespace checks | Pass | Both fixture scripts parse and contain no trailing whitespace |

The 81 product/build/support source hashes still exactly match the final
three-bundle receipt. `src/lib/ai/apimart.ts` SHA-256 remains
`b0d02d8f930f7677d3f1bccd162689446c80bc854f82f1a166a9c20cdccc1d68`.

New frozen fixture hashes supersede the fixture identities from the earlier
Responses-only repair, while that earlier evidence remains historical:

- Fixture: `8275221634b61402a2784f4d3a74272a78fb09f18d6ce53c05b05142f51f5e4b`
- Self-check: `d9bc49dc77e9861c8b8d4284b8f6cc58794ad0195c02a2947a3458a6626c5cf1`

The worker did not operate fixed server port 56368, run computer-use actions,
rebuild applications or retry generation. Root owns the controlled server restart
and actual UI retry of the failed image item; the saved video must not be
resubmitted. Node fixture/adapter success does not itself establish native or
live-supplier acceptance.
