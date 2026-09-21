# Multi-IP profiles and versioned materials

## Goal and approval
User approved the material ownership/version proposal and explicitly requested implementation for IP and materials. Prior menu foundation is committed. This task implements the agreed capabilities, keeping existing video workflows and old assets intact.

## Requirements
R1. Multiple persisted IP profiles: name, positioning, audience, topics, expression, visual/voice preferences; list, create, edit, archive. Projects may optionally belong to an IP, independent by default. No IP deletion cascade.
R2. Material browser has 媒体与资料 and 创作设定 views, actual previews/search/type/scope/status filters, responsive detail panel. Default excludes project-only materials. Legacy studio/project assets remain accessible.
R3. Ownership is global/IP/project; uploads in a selected project belong there. Explicit promotion creates a new independent snapshot retaining source. No inferred formal IP identity. Existing project media/settings can be promoted.
R4. Versioned immutable material snapshots. Explicit project use pins a version and produces project-owned content compatible with existing editors. New material version does not rewrite old project content. Explicit update adopts new revision safely, without overwriting a locally edited structured asset or racing concurrent revisions.
R5. Archive/restore; archived items remain available to existing references but not new adoption. Hard delete only with no references, with transactional guards and visible usage. Source project deletion cannot destroy promoted shared snapshots. Keep provenance and operation events.
R6. IP page shows its projects/materials and derivative quick entries (image/IP image/emoji/merch remain clearly upcoming). Project selector/creation allows optional IP association; existing projects can be manually assigned or detached.
R7. Existing project ZIP remains self-contained for adopted media/settings. Import must not accidentally bind to an unrelated IP/material with same ID. New library data supports its own backup/restore if feasible; do not misrepresent project ZIP as full workspace backup.

## Acceptance
Persistent create/reopen IP; archive doesn't delete projects; project binding validated. Media image/video/audio/document preview, upload, search, scopes, promote, new revision, use in project, manual update, archive and guarded delete verified. Structured settings use actual old entities with immutable media snapshots. Race/transaction rollback and old project regression tests. Desktop and390px no overflow. No live paid requests.

## Excluded
New image/podcast/music editors, commerce/physical production, publishing and analytics. No automatic IP inference, mass retrofit or modifications to old project media. Global chat IP-aware tool automation and chat creation cards remain separate work; no claim implemented.
