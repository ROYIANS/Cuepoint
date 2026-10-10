# Immutable checkpoint and provider protocol design

Status: implemented and independently accepted on corrected, quality-repaired source on 2026-10-10; product commit recorded in task.json; archive follows the approved batch. The corrected workspace foundation is independently accepted. This is a protocol-only child; native storage, full-workspace codecs and live service remain separate gates.

## Smallest supported boundary

Implement a storage-neutral immutable checkpoint and an internally registered transport contract. Do not reinterpret existing project-copy ZIP imports as synchronization: they remap identities. No production table importer/exporter is added here. The only initial record format is an explicit `cuepoint.protocol-fixture.v1` format for disposable protocol tests; it contains exact allowlisted identity/title/media-reference fields and cannot claim a complete project or workspace. Every manifest declares partial coverage and its known record format. A production caller cannot pass raw connector/job/approval objects or an unknown record format through a generic JSON escape hatch.

Allowlisted user text is preserved as authored content. This does not promise keyword-based removal of credentials a user might type into text. Actual connector/result/history codecs require their own reviewed field projection and dormant-execution contract before registration.

## Checkpoint model and identity

A versioned strict manifest contains a real caller-supplied workspace identity (reject `browser-local`), a deterministic immutable revision ID, parent revisions, a declared record format and partial coverage, canonical records, and owned binary entries. A binary entry identifies media/project, expected canonical workspace-relative path, MIME, byte length and SHA-256. Device roots, credential handles, claims and executable envelopes are not portable fields.

Derive revision identity from canonical manifest content using the existing SHA-256 primitive. Define the canonical ordering and exact accepted keys; reject duplicate identities/paths, ambiguous/non-finite values, unknown versions/formats and malformed hashes. Validate parent identity and self-parent/cycle-at-manifest conditions that can be proven locally; do not claim a full ancestry graph proof without loading it. Array reorderings that are semantically unordered should have deterministic canonical output.

Use `mediaWorkspaceRef` to derive and compare canonical owned paths, rather than treating any safe-looking relative path as sufficient. No device root is consulted during publication. The receiver supplies its own root when materializing through its application port. Studio/project ownership and all record-to-binary references in the supported fixture format must close; unavailable required content rejects application. This partial protocol has no replicated delete behavior.

## Preparation and verification

Preparation copies/fixes portable inputs into an immutable prepared representation and verifies each binary's actual bytes, declared size and hash. Large binary verification uses bounded slices and macrotask cancellation opportunities, reusing the accepted incremental hash rather than a full-file synchronous buffer. No ready reference or application callback occurs during preparation/download. Preserve locally prepared work across provider failure or cancellation so the caller can retry; remote partial staging may remain and must not be confused with a published head.

On receipt, parse/validate unknown manifest input, verify workspace/revision/schema/format/path/reference closure, fetch all binaries and verify their complete bytes before handing any supported records to the application port. Reject corrupt, truncated, missing, foreign and unsupported data. Ensure later mutation of caller/provider objects cannot change already verified content or its identity.

## Provider boundary

Expose a narrow internal registry of trusted provider factories and declared capabilities. There is no marketplace or arbitrary module/native-code loading. The transport can store/fetch immutable binary objects and manifests, list checkpoint history, inspect a workspace head, and conditionally update that head. Credentials remain represented by device-local opaque handles; no credential belongs in a manifest. Lifecycle/progress/cancellation and typed error outcomes are explicit. No provider receives arbitrary database tables, SQL, filesystem roots or paid execution access.

Binary and manifest storage are idempotent by immutable identity. Upload all required objects and the manifest before a compare-and-swap head publication. A stale expected head reports a focused conflict and retains both immutable candidate manifests. Provider acknowledgement is a distinct typed result from a device application receipt. An acknowledgement does not imply another device downloaded, materialized or applied anything. Listing/unlink/disconnect must not silently erase local content; remote deletion/retention policy is not implemented here.

## Application boundary and repeated delivery

Define an application port responsible for atomically checking the durable applied-revision ledger and applying only verified supported records/binaries. The protocol validates before calling it; the port preserves the same revision and entity identities and returns an application receipt distinct from publication. The test port uses independent disposable device roots/maps with a persisted-in-fixture ledger, proving repeated delivery and logical restart without duplicate records. It is not a native crash-recovery, SQLite transaction or real filesystem proof.

Cancellation before application prevents the port call. Once an atomic application starts, its actual committed outcome is authoritative; do not report a committed application as canceled because a signal arrived afterward. A failed test-port transaction leaves its prior local state and ledger intact. No imported execution owner or paid job is present in the allowed fixture format.

## Scope and recovery limits

This child proves identity-preserving protocol exchange, validation, conditional-head conflicts, acknowledgement/application separation and retryable immutable preparation with isolated transports. It does not prove full 49-table export, secret sanitization of opaque history/results, native workspace persistence, migration backups, OS containment, real service durability, authentication economics or user-facing handoff/history/restore. Keep those gaps explicit in the final report and parent task.
