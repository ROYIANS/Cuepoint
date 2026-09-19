# Natural-language project image discovery

## 1. Scope / Trigger
Read before changing natural-language image lookup, unbound project reads, discovered-image provenance, native image materialization or source presentation. Extends [Project References](./agent-references.md); the existing attachment pipeline and current selected model remain authoritative.

## 2. Signatures
- `discover_project_images({projectQuery?,projectId?,episodeQuery?,entityKind?,query?,slot?,source?,offset?,limit?})` is a local read tool in `project-references`.
- `read_project_image` accepts exactly one shape: `{mediaId}` for the existing bound path, or `{discoveryCallId,candidateId}` for discovered images.
- `discoverProjectImages(raw,context): Promise<ImageDiscoveryResult>` resolves scoped candidates without pixels.
- `resolveDiscoveredImage(runId,discoveryCallId,candidateId)` reloads completed discovery and current source state.
- `validateDiscoveredInput(input,runId)` validates the completed read ledger, discovery, source and media digest at request preparation.
- `AgentReferenceInput.discovery?: {discoveryCallId,candidateId,readCallId,mediaDigest}` is lightweight code-owned provenance. No database migration or binary duplication is required.

## 3. Contracts
Discovery fields are strict. `entityKind` is shot/character/scene/prop/style; `source` is current (default), reference or candidate. Pagination defaults to offset 0/limit 10, limit max 20. Project/episode/slot identifiers or text have bounded length; query is at most 500 characters.

The result has `discoveryCallId`, `status` (resolved/ambiguous_project/not_found), bounded `projects`, `projectCount`, `candidates`, `total`, `offset`, `hasMore`, and a truthful note. Each candidate has a stable locator-derived `id`, project/episode/entity labels, slot and source category, media identity/type, `available`, optional `unavailableReason`, source `revision`, locator and internal target link. Saved generation candidates also
report `currentlyApplied`, and the UI distinguishes currently applied and unselected
outputs. Episode labels reuse `episodeLabel`, including blank-title fallback. Missing current output stays unavailable; it is never replaced by a reference or old candidate. Discovery is metadata, not visual analysis.

Project names resolve exact matches before partial matches. Multiple projects return choices and no image grant. Repeated shot numbers and different slots remain separate labeled candidates. In an unbound conversation the model must supply the user's named project or a confirmed project identity. Bound conversations retain their frozen project. This does not bind a conversation, inject unrelated project facts/memory or permit mutation. Only discovery and image reading survive the unbound reference-tool filter; document/reference search and project memory remain bound.

Source locators refer to the current slot result, an explicit reference association, a registered image reference or an owned saved generation job. Revalidation checks ownership, target existence, association/media identity, current revision and source withdrawal. Source metadata never authorizes arbitrary filesystem or URL reads.

The discovered reader uses a completed discovery call from the same run/thread. Its input derives from the saved candidate, never model-supplied project/media overrides. It queues image identities and a SHA-256 media digest; queued means prepared for the next model request. Once the reader completes, wire validation additionally requires its completed ledger entry and matching saved input. Validate before and after asynchronous encoding, including live run/thread/model and source availability. Digest computation itself awaits Blob bytes, so re-resolve the source locator after the digest before accepting the validation. Media IDs are immutable through repo.putMedia (add, not overwrite); replacing a picture creates a new ID. Run-scoped provenance cannot authorize a new run.

Both Chat image_url and Responses input_image use the current model. Existing limits remain ten images per request and 10 MiB per PNG/JPEG/WebP image. Image bytes enter only the transient request, never persisted tool results, messages or audits. Provider-call pairing stays idempotent and Responses opaque items remain intact. Historical context retains source identity and interpretation without automatically replaying old image pixels. A fresh visual inspection needs a fresh read.

## 4. Validation & Error Matrix
| Condition | Expected outcome |
| --- | --- |
| Unbound request without project name/identity | Ask for the specified project |
| Several matching projects | ambiguous_project, labeled choices, no candidates |
| Bound request targets another project | Reject foreign scope |
| Missing current image | Unavailable candidate with reason; no reference/candidate fallback |
| Changed source or deleted entity/project/media | Rediscover/error before pixels |
| Forged, incomplete or cross-run discovery/read ID | Reject provenance |
| Same media ID but changed bytes | Digest mismatch blocks materialization |
| Withdrawn reference | Block use even when bytes remain owned elsewhere |
| Unsupported model | Actionable model-switch message; no hidden alternate model |
| More than ten images / unsupported or oversize file | Bounded explicit error |
| New turn or compressed history | No automatic old pixel replay |

## 5. Good / Base / Bad Cases
Good: “Inspect the first frame of shot 3 in Rainy Night” → resolve the named project → list the labeled current candidate → read by discovery/candidate IDs → send exact pixels → selected model analyzes.

Base: existing bound read_project_image({mediaId}) and explicit document/image attachments keep their contracts.

Bad: guess an image from its prompt/filename, choose the first same-name project, silently substitute a reference for missing output, trust input.projectId to grant unbound access, or treat queued pixels as a completed creative result.

## 6. Tests Required
`tests/imageDiscovery.test.ts` and the existing reference/transport suites cover project/episode ambiguity, current/reference/candidate distinction, missing media, binding, studio exclusion, provenance forgery/cross-run IDs, withdrawal/replacement/deletion during encoding, byte mutation, capability/size/count guards, idempotent pairing and history behavior. Retain existing attachment, generation and task-evidence suites.

Native browser validation uses isolated Edge IndexedDB and exact PNG bytes in real discover/read tool loops for Chat and Responses. Image-only tests enable project-references alone. Combined requests must retain both local pixels and external extracted text. Inspect source labels/links at desktop/390px, keyboard behavior and no persisted base64 or changed binding. Mocked models prove application flow, not live-model reasoning quality.

## 7. Wrong vs Correct
Wrong: when run.projectId is empty, use referenceInput.projectId as permission.
Correct: retain the frozen binding rule and admit only a saved, same-run discovered image whose completed discovery/read ledger and live source still match.

Wrong: return an image filename or generation prompt and ask the model to infer its appearance.
Correct: return source identity, queue actual image bytes for the next selected-model request, and identify the source separately from the model's analysis.
