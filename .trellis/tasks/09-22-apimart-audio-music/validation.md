# Integrated validation — 2026-09-22

## Delivered scope

Audio/music project types and routes; v23 durable tables; owned CAS repositories; source/take/clip/work/export lifecycle; ZIP round trip and imported dormant jobs. Audio script/speaker/chapter editing, recording/import/library, real waveforms, multi-track preview, move/edge trim/split, numeric edits, gains/mute/solo/fades, undo/redo, chapter/project WAV export, export history with revision status. APIMart TTS, Flow Music and Suno; all returned results retained independently with original provider indices. Agent project tools/context and paid review share these records.

## Automated evidence

- Local pnpm path: `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm`.
- TypeScript gate passed.
- Full Vitest: **106 files, 1173 tests passed**.
- Production build passed, with existing >500 kB chunk advisory (no build failure).
- Model bank snapshot verified: 197 files, 85 providers, 1855 models.
- `git diff --check` passed.
- All gates rerun after the final shadcn/Radix slider correction; 106 files / 1173 tests passed again.
- Provider calls in tests use deterministic fixtures, not a real paid APIMart account.

## Browser evidence

Tested localhost in the Codex in-app browser at desktop 1440×1000 and narrow 390×844:

1. Created an Audio project without API key or Agent; edited a segment and observed persisted text after reload.
2. Imported a locally generated 4-second PCM WAV through file chooser; actual browser decoding stored a take and metadata.
3. Explicitly adopted the version and independently placed it on the voice track; split at 2 seconds, edited fade and undid the edit.
4. Timeline preview entered playing state and progressed to the 4-second end.
5. OfflineAudioContext rendered an actual WAV; UI confirmed saved export. After reload, export history remained and its custom player decoded 4 seconds and entered playback.
6. Created a Music project; edited Suno description, switched to Flow retaining description, saved title/BPM, reloaded and retained Flow draft/title/description.
7. Narrow audio panel switches expose sources/export history; narrow music exposes creation/library/details/player. Both measured document width equal to scroll width, no page horizontal overflow.
8. Replaced native select/range/audio controls/details with shared library primitives/custom accessible controls. Music DOM had zero native select and audio[controls] elements.
9. Final controls restored existing shadcn defaults. Slider keyboard ArrowRight changed zoom from 40 to 41; audio narrow sources/history switch remained accessible.
10. Found and fixed an actual workspace navigation loop: outgoing /projects must not be redirected by the still-mounted audio project chrome. Return-to-studio then succeeded in browser; four route regressions added.

## Recovery and safety regressions

Unknown provider statuses retain diagnostics and pause automatic polling. Failed sibling tasks, malformed result entries or individual downloads do not discard valid works. Interrupted partial downloads continue querying remaining known tasks. Binary MIME is identified from bytes. Deleted results retain tombstones, so retries neither fail on stale local references nor recreate deleted works. Agent ask/assist/full all require reviewed generation, preflight revisions/connector identity are checked, and resumed calls never repeat paid POSTs.

## User visual contract

Use existing shadcn defaults, including normal rounded corners, borders, shadows and focus treatment. Do not use browser-native visible form/media controls, decorative left borders, or excessive nested/oversized rounded cards. This means reducing redundant wrappers, **not** flattening all controls into sharp rectangles. Final correction restores shadcn defaults and a shared Radix/shadcn slider.

## Explicit limits

- No real paid TTS/Flow/Suno request was made. Account balance, provider-side CORS and live service output remain unverified.
- Physical microphone permission/capture was not exercised; recorder tests cover denial, late permission, final data and cleanup using mocks.
- Browser evidence covers the in-app Chromium environment, not every browser codec or device.
- Music arrangement/continuation/covers/stems/MIDI remain outside this release.
- Mixed audio export is WAV. Imports enforce 32 MiB source and 64 MiB decoded limits; render uses a 256 MiB budget.
- Split inside an existing fade rejects rather than changing the audible envelope; move the split or adjust fade first.
- Agent manipulates project structure and generation; microphone/file picker/export remain explicit manual workspace actions.
- No git commit, push, deployment or task archive has been performed.


## Continuous-manuscript redesign validation (2026-09-22)

The user rejected paragraph form cards after the initial Fish-inspired pass. The final pass follows the supplied screenshot more closely: continuous editable lines, no per-line header/footer/cards, hover/focus gutter controls, contextual voice history, and compact timeline.

- Final automated gate: **108 files / 1186 tests passed**, TypeScript passed, production build passed (existing chunk-size advisory), model-bank verify passed; `git diff --check` passed.
- Added 9 script helper tests covering line import, selection split, speaker/order inheritance, empty trailing line, multiline paste, stale/cross-project rejection and transactional rollback; 4 timeline geometry/snap/label tests.
- Browser at 1440×1000: imported five realistic script lines, verified plain manuscript; selected linked clips; used ruler pointer/keyboard seek; split and undo; edited fade and undo; played decoded WAV; exported actual WAV with saved-project confirmation.
- Browser editor: Enter produced an independent line and moved focus to its start; empty-line Backspace removed that line and focused the previous line; direct multiline paste created separate ordered textareas and focused the new last line.
- Browser at 390×844: script remains readable and transport reachable; Edit mode exposes separate Undo/Redo/Split/Fit/Zoom row. Document scroll width equals 390; no page horizontal overflow.
- Browser at 1024×800: row gutter opens the correct contextual Sheet (only one mounted dialog); document scroll width equals 1024. Textarea heights recompute across viewport/inspector widths using ResizeObserver.
- Recording dialog remained open crossing 390→1200 breakpoint; no physical microphone request was made. Recording/source dialogs are hosted once in the persistent workspace and freeze their target line.
- Read-only integration audit resolved keyed draft targets, cross-chapter source selection, stale async playback, SourcePlayer cleanup, and project-level job polling independent of panel visibility.
- No new real provider request, physical microphone capture, commit, push or deployment. Earlier explicit limits still apply.

## User-requested checkpoint commit

Implementation committed as `cfc3cd7` after explicit user authorization. The validation above describes pre-commit verification; no source changes occurred after those passing checks. Task remains available for subsequent UX optimization. No push, deployment or task archive.


## Agent creation and music UX follow-up (2026-09-22)

- Agent `project_create` supports video/audio/music, preserving video as the default and rejecting video-only settings for sound projects. Creation seeds real audio chapter/voice-track or music draft records inside the existing atomic tool transaction. Existing bound conversations keep their project scope; creation results offer an explicit new conversation bound to the created project.
- Music uses a compact creator, work list, optional detail panel/Sheet and shared persistent player. Simple description and Custom lyrics live in separate durable drafts; variant links contain IDs only and validate project ownership and mode before reuse.
- Search, favorite filtering, date grouping, playback queue and responsive Creation/Works navigation are implemented. Generation activity and failures remain visible. Submission locks draft/engine switching, and thrown submission errors retain the visible Creation panel.
- Read-only integration review covered tool discovery/scope/atomic replay, variant persistence, submission concurrency and player state. Both reported issues were fixed: Simple title is labeled as a draft name, and mobile switches to Works only after submission returns.
- Integrated tests: **109 files / 1199 tests passed**. Final TypeScript, production build, model-bank verify (197 files / 85 providers / 1855 models), and `git diff --check` passed. Build retains the existing large-chunk advisory.
- The earlier browser evidence above applies to the previous checkpoint. **This follow-up has not been visually reverified in a browser or on a physical phone**: in-app browser automation could not connect, and the user's active production browser was left undisturbed. Responsive behavior has code review coverage only this round.
- No paid APIMart request or live LLM end-to-end request was made; provider and Agent tests use deterministic fixtures. No provider wire contract, database schema or dependencies changed.
- User explicitly authorized a checkpoint commit for this follow-up after the checks above. Browser visual recheck remains pending. No push, deployment or task archive.
