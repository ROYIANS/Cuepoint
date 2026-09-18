# Production foundation audit

## Outcome
The application has a working manual authoring backbone, but it is not ready to be called a complete, reliable production workspace or to accept concurrent AI writes. Fix data integrity and workflow truthfulness before expanding forms. Then connect the existing asset collections to actual shot context and delivery.

Evidence comes from source review, existing tests, isolated in-memory characterization probes and actual browser walkthroughs. Findings distinguish demonstrated defects from missing product capabilities. Research detail is in `research/assets-audit.md`, `research/workflow-audit.md`, and `research/ui-and-ai-boundaries.md`.

## Coverage against the user's four questions

| Dimension | Assessment | Next action |
| --- | --- | --- |
| UX/configuration | Basic navigation/forms are present; save feedback, error recovery, return context, keyboard/touch access and narrow-screen shot toolbar are inconsistent | Repair recoverability and primary actions before cosmetic redesign |
| Information completeness | Free text can hold detailed information, but project/prop/style schemas are thin and continuity data is hard to reuse | Small core plus optional structured sections, preserving current prose |
| Future AI readiness | Good ownership/repo/slot/local-media boundaries; missing atomic writes, context relations, revision/provenance contracts | Use the same safe mutation pipeline for manual and later generated changes |
| Complete manual flow | Story→beat→shot→manual attachments→CSV/print/backup exists; props/style/reuse and reliable handoff are incomplete | Repair existing flow, add usage links and real media delivery; define video-editing boundary separately |

## Consolidated priorities

| ID | Priority / category | Finding and observable impact | Evidence |
| --- | --- | --- | --- |
| F01 | P1 defect | Concurrent independent field/slot patches lose earlier updates | repo.ts:654,664,1117; isolated asset 2/2 characterization and shot probe |
| F02 | P1 defect | Asset text/upload/save failures are not recoverable; slot closes before persistence completes | CharacterDetailPage.tsx:80; GenerationSlotCard.tsx:160,269 |
| F03 | P1 defect | Project-global beat filter leaks across episodes; restored ZIP retains old beat IDs and can hide all shots | ShotEditorPage.tsx:269,492; projectPackage.ts:140,568,607; isolated reproductions |
| F04 | P1 foundation reliability | Canceled/replaced draft uploads remain unreachable Blobs | media.ts:46; GenerationSlotCard.tsx:164,175,186; source trace |
| F05 | P1 defect | Nonexistent media IDs and image placeholders can pass video delivery checks | episodeDelivery.ts:83; shotFilters.ts:26; isolated reproduction |
| F06 | P2 defect | Two concurrent episode deletions bypass last-episode protection | repo.ts:405,416; isolated reproduction |
| F07 | P2 defect | Immediate backup can omit dirty debounced text; snapshot reads are not one transaction | WorkspaceChrome.tsx:283; debouncedDraft.ts:17; source-confirmed timing gap |
| F08 | P2 defect | Locate-shot links do not reveal filtered-out targets; printed content is clamped | ShotEditorPage.tsx:332,348; StoryboardPrintPage.tsx:97,117 |
| F09 | P2 defect | Partial studio-copy failures trap retry on already copied hidden selections | AssetLibraryPage.tsx:359–383; repo.ts:568 |
| F10 | P2 UX/accessibility | Hover-only destructive controls, unassociated labels, missing video playback/full image inspection | AssetLibraryPage.tsx:322; field.tsx:12; MediaThumb.tsx:27 |
| F11 | P2 UX | World return resets tab; no project/picker search; global asset owner becomes unclear in detail | AssetLibraryPage.tsx:103,160,387; AssetLibraryPages.tsx:110,159; browser confirmation |
| F12 | P2 UX | Film page uses episode language; 390px shot toolbar collapses heading and overflows primary controls; default English error boundary | StoryPage.tsx:153; ShotEditorPage.tsx:669; __root.tsx:7; browser confirmation |
| G01 | Core missing capability | Props and styles have CRUD but no usage links; no project default style/shot prop relation | domain/types.ts:141,215,230,282 |
| G02 | Core missing capability | Beat cast/scene are not initial defaults for newly created shots; authored assets cannot be chosen as slot references | repo.ts:153,1060; GenerationSlotCard.tsx:164 |
| G03 | Information extension | Useful continuity fields are buried in prose; asset/master ownership and reuse deserve explicit presentation | Asset field inventory in research/assets-audit.md |
| G04 | Delivery extension | CSV/print are available; no shot-oriented media package, sequence preview or merged video | ProducePage.tsx:84; projectPackage.ts:424 |
| G05 | AI integration boundary | No typed target/revision/result provenance or candidate lifecycle | domain/types.ts:13,18,308; no job/revision fields |

Severity ranks action priority, not proof of frequent occurrence. F04 is prioritized because large abandoned videos threaten storage reliability; runtime concurrency probes establish valid interleavings, not a measured user incident rate.

## Module information inventory and proposed additions

| Module | Already editable | Recommended optional additions / connections |
| --- | --- | --- |
| Project | Name, film/series, aspect, cover, logline, world/background/rules | Synopsis, genre/tone, target duration and default visual style; output resolution/FPS only with consumers |
| Character | Name, bio, appearance, notes, five visual slots | Narrative role, age description, personality/motivation, stable visual traits, relationships and costume/prop continuity |
| Scene | Name, location, time, atmosphere, notes, three visual slots | Interior/exterior, era, layout/landmarks, weather/light and continuity constraints |
| Prop | Name, kind, notes, three visual slots | Appearance/material/color/scale, purpose/state; assignment to relevant shots, optional owner |
| Style | Name, notes, three visual slots | Medium/art direction, palette/light, texture/composition/lens, negative constraints; project default and explicit shot override |
| Beat/shot | Script/beat text, cast/scene/time; shot duration/content/camera/emotion/sound/notes | Initial context inheritance, prop/style links, existing-media picker, clear manual readiness levels |

These are recommendations for a later expansion batch, not claims that prose cannot currently store those details. Keep only names/basic identity prominent; other creative fields remain optional. Preserve all existing notes and imported legacy content.

## Recommended implementation order

1. **Reliability and manual recovery**: F01–F10, plus narrow error recovery needed by those flows. Preserve current product semantics; correct inaccurate checks and broken state scope. First concrete implementation plan is in design.md/implement.md.
2. **Connected asset model and forms**: G01–G03 with F11–F12 UX. Prefer project default style + explicit shot override, shot prop references, initial cast/scene defaults, in-project reference picker, owner-aware library views, optional field groups and project/picker search. Include delete/copy/import/export behavior together.
3. **Manual handoff and AI-facing data contracts**: named per-shot media package/full storyboard, source/target/revision/provenance contracts and safe apply behavior. Keep AI scheduling/provider execution separate. Full timeline/editor/render-to-one-video is a separate product scope, not implied by connector integration.

## Acceptance of the overall foundation
A user can create a film or series, define/select assets and world rules, write/import a script, break beats and shots, bind cast/scene/props/style, reuse or upload references/results, inspect clips, understand missing work, export complete documents/media and restore without hidden/lost work. Every step is possible without an AI key. Later AI calls invoke the same validated write operations and cannot silently replace newer manual work.

## Verification and limits
- Existing relevant suite: 8 files / 55 tests passed; it did not cover demonstrated issues.
- Isolated fake-indexeddb probes reproduced concurrent asset/slot and shot update loss, cross-episode/ZIP filter defects, false readiness and last-episode deletion race. The asset characterization files are retained under research and excluded from default product tests; they assert the current bug, not desired correctness.
- Browser sequential authoring and production-build navigation/checklist were exercised, including 390×844 responsive review. Production preview worked; dev module import failure is separately qualified in UI notes.
- No actual AI calls, no real user project edits or credential access. Two clearly named local audit samples were created; no samples were deleted.
- Actual media upload, printer/PDF output and complete browser ZIP restore were not exercised. Source and repository tests establish those boundaries, with explicit limitations.

## Review status
Audit is complete. No product fixes applied in this task yet. Proposed first implementation batch awaits final scope approval. Later field/relationship/delivery expansion is recorded as the continuing goal, not silently dropped.


## Implementation update — 2026-09-18
The user approved the first batch. R1–R6 implementation is complete and undergoing final independent review/browser verification. Follow-up tasks are 09-18-asset-output-foundation and 09-18-handoff-ai-data-contracts. Refer to verification.md for current results; earlier planning/status notes above describe the audit checkpoint only.
