# First repair batch design

## Boundaries
Changes live in repo mutation contracts, draft/media lifecycle helpers and their existing consumers, filter ownership/normalizers/package remapping, and delivery/print. Keep current UI structure and manual creative semantics. New asset relationships and AI jobs are a later batch.

## Atomic writes
Use field-level Dexie updates for independent scalar patches or transactional read/merge/write where normalization/nested slots require latest data. Slot change and safe orphan cleanup must account for all committed references. Existence and ownership checks remain at repo boundaries. Move sibling-count validation into the same episode delete transaction. Tests use concurrent calls rather than timing-based UI assumptions.

## Draft/save lifecycle
Reuse/extend existing debounced draft and DraftStatus contracts, avoiding duplicated queues. Asset text drafts must not reset during unrelated liveQuery updates. Slot save returns Promise, has pending/error/retry state and closes on successful commit. Track only uploads created by this draft or stage Blobs until commit; settle pending operations before safe cleanup, and don't remove previous/shared media. Keep failure recovery clear and handle cancel during upload.

Expose a workspace draft-flush registry or equivalent scoped barrier with explicit rejection when any write fails; backup waits for all active draft writes before one consistent read transaction captures exported data. Avoid changing browser-close guarantees beyond what async storage can actually provide.

## Filter migration
Move filters into episode-scoped preferences while retaining project-level shot creation defaults and column/view settings where appropriate. All filter dimensions become episode-specific for predictable behavior. Normalize missing episode preferences to defaults. For legacy project filters, retain status/gap preferences and copy only beat IDs belonging to each episode (retain unassigned sentinel), then ensure imported IDs remap. Choose minimal schema/version migration based on Dexie/index requirements; no needless index churn. Deleted beats prune their filter IDs. Locate-shot temporarily reveals target or clears conflicting filters with visible feedback.

## Readiness and media inspection
Resolve current media records and referenced scene validity in shared delivery/filter derivation. A clip image is a planning placeholder, not finished video. Preserve editable shot status independent from computed readiness. Provide explicit missing/wrong-kind/reference-invalid reasons; no need for auto-status mutation. Images get fit inspection and videos controls in a dedicated non-nested viewer. Correct useMedia stale display/error state if required to make inspection truthful.

## Copy, labels, print
Track successfully copied selection IDs so retry excludes them; keep per-item transaction guarantees. Associate labels/descriptions with stable IDs in shared Field and direct consumers. Replace display:none hover-only controls with accessible focus/touch behavior. Remove print truncation with print-friendly pagination and verify long text. Keep non-AI wording improvements local to media editor where needed.

## Compatibility and rollback
Old JSON packages and existing free text remain supported. New preference fields require normalize/remap coverage and old-version fixtures. No key/provenance secrets enter packages. Changes should land in reviewable substeps with full-scope integration review. Persistent migration should be additive; do not remove old data before successful conversion. Keep unrelated .tanstack untouched.
