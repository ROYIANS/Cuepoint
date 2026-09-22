# Validation — 2026-09-22

## Delivered
MiMo connector with configurable base/key and read-only model probe; non-streaming preset TTS, voice design and clone generation through existing durable jobs; project speaker profiles; project take/upload/recording WAV references; actual optimized text preserved separately; Agent discovery, reviewed generation and profile CRUD; reference ownership/fingerprint checks; media GC/ZIP remapping.

## Evidence
- Final TypeScript passed.
- Full Vitest: 111 files / 1247 tests passed.
- Model bank verified: 197 files, 85 providers, 1855 models; no vendor edits.
- Production build passed (existing large-chunk advisory); final post-review build checked before completion.
- git diff --check passed.
- Transport tests assert wire roles, mode fields, read-only probe, fixed path, credential redaction, malformed audio, encoded clone size and no retries.
- Runtime tests cover owned/changed sample rejection, original response checkpoint/decode recovery without paid replay, optimized text vs manuscript, GC, ZIP remapping and dormant imported jobs.
- Agent tests cover reviewed clone sample replacement rejection, exact design request and original manuscript preservation, reusable profile create/clear and bounded instruction pagination.
- Read-only review identified and resolved stale speaker settings overwriting concurrent changes, unbounded speaker instructions in Agent reads and misleading optimized-text status labels.
- Initial integrated run had a new test fixture duplicate tool-call ID and a pre-existing long-loop timeout under load. Fixed fixture and reran affected tests, then full suite passed without raising timeout or changing production loop behavior.

## Limits
Browser automation cannot connect (Codex auth token unavailable). No claim of desktop/mobile visual or physical microphone validation this round. No live MiMo key/probe, paid generation, real model Agent run or provider CORS verification. First implementation uses full WAV completion; low-latency stream playback is outside this scope. No hosted voice registration API is claimed: saved voice profiles contain descriptions/references and outputs can be reused as clone samples. No new dependency or database version. Changes uncommitted; no push/deployment.


## MiMo-first UX follow-up

- Always-visible project Voice Library and Dubbing toolbar entries replace the hidden setup path. Manuscript gutter now selects role or opens the same library; normal paragraph controls show reusable voice and Generate plus optional delivery guidance.
- Library creates named project speakers through description, clone reference or preset, optionally auditions through durable jobs, and explicitly saves. A design audition can become a clone reference. All Agent-created speaker profiles appear through the same live project snapshot.
- First-use setup stores MiMo credentials in-place through the existing connector repository. Configured MiMo is automatically selected; missing MiMo does not fall back to APIMart. Legacy explicitly configured APIMart roles remain usable.
- Agent can omit repeated connection/model parameters and inherit speaker configuration; approval checks current profile and connector, recovery uses durable job snapshot. Default speaker creation is MiMo.
- Read-only review aligned old unconfigured speaker labels with actual MiMo default behavior. Editor mutations use captured CAS revision; project/segment checks guard selected-voice assignment.
- Final full suite: **112 files / 1253 tests passed**. Final TypeScript, build, model-bank verify and diff check passed. Existing build size advisory remains.
- No browser visual/mobile/live-provider verification; previous browser automation connection limitation remains. Changes remain uncommitted.


## User-authorized checkpoint
The user requested committing this MiMo integration and UX follow-up after the passing checks above. No source changes were made for the checkpoint. Browser/live-provider verification remains pending. No push, deployment or task archive.
