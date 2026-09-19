# Resolve project images from natural-language requests

Status: integrated implementation approved by user with “ok” on 2026-09-19. Parent: 09-19-agent-web-vision. Implement after web-research child verification.

## Goal
A user can ask to inspect a project's generated storyboard or asset image in natural language; AI locates and reads the image without an attachment or media ID.

## Evidence
- `referenceTools.ts` already implements real-pixel `read_project_image({mediaId})`, but requires a bound project.
- `references.ts:searchProjectReferences` searches registered references, not every generated shot/asset output.
- `businessStore.ts:projection` exposes current slot result IDs; search summaries omit image availability. Current skill instructions do not teach an explicit full discovery-to-pixels sequence.
- `referenceContext.ts:validateReferenceInput` and `ai/referenceWire.ts:pixels` require every input project to equal run.projectId. Unbound access needs a proven read scope, not just an optional tool argument.
- These are confirmed gaps; the user's original failed conversation has not been reproduced or attributed to one specific cause.

## Requirements
- V1: Discover image candidates by project/episode/shot/asset name or number, returning meaningful labels and actual ownership/current source state. Unique results proceed; multiple projects/episodes/slots are clarified or deliberately compared as requested.
- V2: Default to current applied slot output. Explicitly distinguish reference inputs and downloaded unselected candidates; do not silently substitute an older/reference image for a missing current output.
- V3: In unbound smart conversations, an explicitly named project may be resolved and inspected read-only. Do not bind the conversation or grant cross-project mutation. Bound conversations stay within their frozen project.
- V4: Reuse selected-model pixels for Chat and Responses; record discovered project/target/media provenance. Revalidate current source before dispatch; changed/deleted source triggers rediscovery/error instead of analyzing the wrong image.
- V5: Preserve existing bound mediaId reads, explicit attachments, reference withdrawal, history compression and 10-image/10 MiB PNG/JPEG/WebP limits. Unsupported vision asks for a model change, never invokes an extra hidden model.
- V6: Teach and expose discovery+read as one usable skill path, independent of enabling general business editing. Show what image was read and retain useful source links.

## Acceptance
- VA1: A user-language request without attachment in an unbound conversation resolves the named project/shot and sends exact target pixels in Chat and Responses; binding remains unchanged.
- VA2: Bound reads reject another project; forged/stale/cross-run discovery identities cannot authorize pixels.
- VA3: Duplicate project names, repeated shot numbers across episodes, missing current output, reference-vs-result and selected-vs-candidate cases are correct and explicit.
- VA4: Deletion, replacement or reference withdrawal during encoding blocks transmission; resume/compression avoids duplicate pairing or repeated historical pixels.
- VA5: Desktop/mobile run details identify the actual source. Combined web research + local image analysis preserve distinct sources; existing attachment/generation/task suites pass.

## Boundaries
Existing project images, current model vision and read-only discovery. No studio-global unbound image expansion, arbitrary filesystem/URL reads, video analysis, image regeneration, cross-project editing, automatic rebinding or hidden alternate model. No blocking product decisions remain.
