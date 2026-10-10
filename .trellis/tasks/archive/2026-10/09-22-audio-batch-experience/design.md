# Reviewed batch speech production

## Goal and boundary

Complete R3/R5 with one concrete review, durable exact per-item progress and explicit recovery/retry. Reuse the current speech normalization, MiMo/APIMart adapters and single-job submit/download runtime. Existing image/video `GenerationBatch` stays unchanged because its targets and jobs have a different schema.

## Product behavior

- One audio project/chapter, 1–20 distinct nonempty segments, at most two concurrent requests. More than 20 is a visible error requiring a subset, never a silent split or omission.
- A compact chapter action opens a flat review of text, inherited saved speaker settings, connector and included items. Default to eligible segments without a saved take; explicit subsets are supported. Flush manuscript drafts before preparation. Missing text/voice/connection is visible before confirmation.
- One confirmation authorizes the exact frozen included items. Display request count and supplier billing disclosure without inventing prices. Agent preparation creates a draft only; model flags cannot approve paid generation.
- A shared workspace/Agent disclosure shows counts and item states: queued, submitting, pending, saved, failed, uncertain, cancelled and local recovery. Saved, selected, placed and not auditioned remain distinct.
- Pause stops new sends and drains/checkpoints in-flight work. Cancel marks unsent items cancelled, preserving accepted/uncertain work and saved outputs. Reload reconciles local/known jobs without POST; explicit continuation resumes only still-current confirmed unsent items.
- Failed-only retry creates a new unconfirmed draft from an explicit subset of definite provider failures. Saved, pending, uncertain, removed saved results and local decode/download recovery are excluded. Existing bytes/known GET recovery use a separate nonpaid action.

## Storage and transport

Add audio batch and item tables in the next available Dexie version (reserve v24 after integration check). Domain/repository modules own scoped validation, revision/CAS, stable item/intent IDs, ordered snapshots, approval, pause/cancel and retry derivation. Item jobs use the existing audio runtime; no fabricated bulk provider endpoint or synthetic paid tool call.

Batch records contain project/chapter, manual or original Agent task/thread/run/preparation-call owner, revision, lifecycle, confirmed snapshot/fingerprint, item order, retry source and pause reason. Items contain segment and speaker baselines, normalized input, connector/reference fingerprints, stable intent and actual job ID. Persist no keys or encoded clone bytes.

Extend the typed audio job source with batch/item identity and original provenance. Submission requires the durable batch confirmation guard, including for Agent full access. Agent batch dispatch retains scope, relevant enabled skill, latest owner and thread lock semantics; preparation calls may already be completed, so do not reuse their single-call running guard. Revalidate approval/input/credential/reference state immediately before each POST.

Hold exclusive batch ownership until both workers and all state writes settle. Use Web Locks and existing per-job locks; fail closed when cross-tab dispatch ownership cannot be guaranteed. Persist prepared job linkage before claiming/submitting. A transport ambiguity pauses new dispatch and never allows automatic paid replay. A pause persistence failure must still stop local dispatch immediately. Use an in-memory pause latch and all-settled draining.

Add a typed definite-failure/recovery-stage fact where needed; never classify paid retry eligibility from error-string keywords. Preserve all current single-job status meanings and saved outputs.

## Lifecycle and compatibility

Update project/chapter deletion, transaction tables, orphan/reference retention and late-result guards. Export project batches as dormant historical records with remapped chapter/segment/job/reference IDs and scrubbed live approvals/claims; imports never confirm, dispatch or poll. Old packages without batch fields remain accepted. R2 task provenance recognizes batch submissions and independent saved outputs; preparation is not generation proof.

## UI ownership and rollback

Use existing Dialog/Sheet/Button conventions with focus/Escape, keyboard item controls and 390 px layout. IDs and full settings live in details. Keep single speech generation intact. Disable a faulty batch UI/dispatcher while retaining persisted records and individual jobs; never downgrade or delete accepted paid evidence.

## Evidence

Implementation research: [current gap and design](research/current-gap-and-design.md). Automated mixed-result, race/fault, Stop/reload/retry, ZIP/cascade and source tests precede independent quality/full-test/build. Native desktop/narrow acceptance and controlled real-model tool-choice traces are required, with actual vendor/device limitations stated explicitly.
