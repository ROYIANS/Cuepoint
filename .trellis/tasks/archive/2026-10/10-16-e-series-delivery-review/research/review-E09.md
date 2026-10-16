# Review E09 — agent-installable-skills (0c7b8b10, e7a5c8ff, 0449ed6f, 1e74e0c8)

Read-only review on `codex/agent-background-host`. Labels: [code] [test] [claim-only]. I did not run any build or test for this report. Test counts in `task.json` are [claim-only]; I read the test sources for what they assert.

## Verdict

This is the strongest of the three deliveries. The core security idea holds up in code: skills are inert text, the model reads only run-pinned revisions through two fixed read tools, and no field of a skill can touch tool policy. Storage is split into immutable content rows with explicit reference counting. The remaining issues are robustness and parity ones, not authority leaks. The main ones are a browser/native divergence that makes real-world skill folders fail in the browser, and the reference-count capacity model that can wedge updates. Installed-UI, picker and Windows behaviour are all unexecuted (see `task.json` meta, `pendingAcceptanceOwner`).

## Acceptance mapping

| AC | Status | Evidence |
| --- | --- | --- |
| AC1 metadata without bodies; model request omits text; load/read hydrate only selected rows; both protocols keep envelopes through compaction | **Met** (source) | [code] `installedSkills.ts:11-52` (`loadInstalledSkill` reads manifest + body only; `readInstalledSkillResource` reads manifest + one resource row), `disclosure.ts:7-14` (metadata-only catalogue). [test] `installedSkillTools.test.ts:63,77`, `installedSkillRuns.test.ts:49,265`, `installedSkillProtocols.test.ts` (two protocols). "Through context compaction" was not located as a separate assertion; it relies on tool-result durability (see `runSkills.ts`). |
| AC2 update/disable/uninstall change new sends; running/retried runs read exact old revision; reinstall cannot revive identity; referenced content survives | **Met** | [code] `retainInstalledSkills` pins at admission and passes `previous` on retry (`retention.ts:49-65`, `agentRuns.ts:138-139`); `createId("skill")` gives a fresh identity on install (`installations.ts` `updateEntries`). [test] `installedSkillRuns.test.ts:131` (retry bytes after update/disable/uninstall/same-name reinstall), `:151`, `:184`. |
| AC3 zero extra authority; unlisted/foreign/escaping resource names reject before access | **Met** | [code] `requireCapturedSkill` checks run membership, running status, interaction mode, exact saved arguments, `readMetadataMatches` (`tools.ts:35-52`); resource name resolved only via the manifest `.find` (`installedSkills.ts:48-49`); no model-visible path ever reaches an OS API. Skill text carries no tool field (agent-core `skills.ts`). [test] `installedSkillTools.test.ts:130,162`. |
| AC4 invalid YAML/UTF-8/ambiguous paths/duplicates/changed input/unsupported native sources/limits fail before publication; known failure rolls back; uncertain commit needs readback | **Met (source) / Windows unverifiable** | [code] `decodeSkillFrontmatter`, `eligibleImportFiles`, `verifySkillCandidate` (`package.ts:40-145`), single `store.transaction("rw", ["deviceSettings"])` (`installations.ts` `mutateSkills`), operation-ID + fingerprint dedupe (`:30-33`). [test] `browserSkillImport.test.ts:33,57`, `installedSkillsUi.test.tsx:115,134,145`. Native capture: [test] Rust `skill_import_*` (11 tests, [claim-only] execution). |
| AC5 concurrent admission/update/uninstall/delete keep exact counts; delete of the last owning thread collects an obsolete revision; preview == dispatch | **Met** | [code] `releaseInstalledSkills` inside the thread-deletion transaction (`lifecycle.ts:49`, `retention.ts:70-90`), shared `composeRunSkills` for preview and admission (`runSkills.ts`). [test] `installedSkillRuns.test.ts:194,216,234,248,265`. |
| AC6 install/enable/inspect/update/uninstall from retained chat in wide and narrow layouts; focus/return; no duplicate action | **Partly met (jsdom only)** | [test] `installedSkillsUi.test.tsx:77-353`. Wide/narrow layout, real focus and the real picker are [claim-only]/unverifiable here. `1e74e0c8` repairs `useInstalledSkills` after a dogfooding finding, which shows UI bugs were already being found by hand. |
| AC7 neutral consumer with its own byte source validates and loads the same fixture without Studio/React/Tauri | **Met** | [test] `agent-core/src/skills.test.ts:157` ("discovers without content reads and loads only captured, requested text") plus the documented public API in `.trellis/spec/agent-core/library/skills.md`. Studio owns YAML (`package.ts`), the core owns validators and paging. |

## task.json claims verified

- "no project override / no sync / device-local": [code] true; state lives in `deviceSettings` keys (`agentSkills.*`).
- "no second Agent loop / ProductStore": [code] true; the two tools are ordinary `defineTool` atomic reads.
- "Native reads only bounded text": [code] true (`skill_import.rs:14-21` limits, response ceiling check at `:132-134`).
- Stage 2 "11 Rust tests passed": [claim-only] — I read 5 of them (`skill_import.rs:553-690`), which test the shutdown drain, text preservation/pruning, the envelope and quiet cancel. No test for a symlink swap, a mid-read mutation or a Windows junction was found in the part I read.

## Findings

### P1

None. No authority-escalation path was found: skill content cannot reach filesystem, process, network or tool-enable decisions. The tool description and catalogue both state "untrusted, no extra authority" (`tools.ts` `load_skill` result `notice`; `disclosure.ts:10`).

### P2

**F1 — Browser import fails for ordinary skill folders that native import accepts** [code]
- Browser path builds a `File` list from `webkitdirectory`, which enumerates the whole tree. It throws if `files.length > 1,024` (`browserImport.ts:13`) and runs `validateSkillImportPath(path)` on **every** supplied file, including ones that will be excluded (`:21-23, 25`).
- Native capture instead prunes `scripts/`, hidden and unknown root directories without descending and counts each excluded subtree as one entry (`skill_import.rs:~330-380`, `walk`).
- Impact: a skill folder containing `.git/`, `node_modules/`, a `scripts/` tree, or any file with `: ? * " < > |` in its name imports natively but fails in the browser with "技能目录条目过多" or an invalid-path error. Both paths claim to share "the same validation", but the pre-filter differs. The PRD only promises `excluded files are reported`.
- Fix: in the browser, apply the exclusion filter (hidden segment, non-`references|assets` first segment) before count and path-validity checks, and count excluded subtrees by root.

**F2 — Retained-revision quota can wedge updates with no in-product remedy** [code]
- Every revision pinned by any run stays until every owning thread is deleted. `addContent` rejects new content at 128 revisions or 64 MiB, with the message "请先清理相关历史对话" (`installations.ts` `addContent`). An active user who iterates a skill (each manual update = new revision) while keeping chat history will eventually be unable to update, enable or install anything. `readSkillRetentions` also reads every retention row on each mutation and each run admission (`retention.ts:15-26, 54`), so admission cost grows with retained revisions (up to 128 rows).
- The design accepts this (R4), but there is no UI to see which threads pin which revision, nor a "release historical content" path. It is a design gap, not a bug.

**F3 — Windows: junction/placeholder behaviour is only partly handled in native capture** [code, unexecuted]
- Symlink/junction entries are detected via `fs::symlink_metadata` (`skill_import.rs:~372`) and rejected or excluded. Accepted files then go through `paths::ordinary(path, 1)`, which on Windows errors for any reparse point (`paths/windows.rs:127-134`). A OneDrive/cloud placeholder inside `references/` therefore fails the whole import with `containment` rather than being excluded. This is the same defect class as E08-F1 but smaller in blast radius, because supported files are few.
- The same `walk` runs `portable_path(&path)?` on every entry, including excluded ones (`:342`), so one `README:1.md`-style name or a non-UTF-8 name in `references/` aborts the import (`path_error`), where the browser path rejects it as well. Consistent, but stricter than "excluded files are reported".

**F4 — `File::open` without `O_NOFOLLOW`; safety relies on after-the-fact identity checks** [code]
- `open_text` on Unix is a plain `OpenOptions::read` (`skill_import.rs:481-496`); containment is enforced by `symlink_metadata` before and `verify_file` (dev/ino/nlink/len/mtime) before and after the read (`:420-445, 468-480`) and by re-checking every ancestor directory's identity (`check_directories`). A swap between the lstat and the open would read through the symlink target, but the post-open identity compare against the pre-open `before` stat fails the capture, so the bytes never leave the function. Content is bounded (<=128 KiB), so the exposure is a failed import, not a leak. Acceptable; call it out because the spec says "check native containment before/after reading", and it is "after", not "by construction".

### P3

- F5: `load_skill` result size guard uses `JSON.stringify(result).length` (UTF-16 code units) against 65,536 (`tools.ts` execute), while the persisted-value limit elsewhere is UTF-8 bytes. A CJK-heavy 32 KiB body can serialise to more bytes than the guard counts. The stricter `skillSerializedBytes` limit protects storage, so the effect is only a guard mismatch.
- F6: `priorSuccessfulLoad` parses and re-validates the saved `load_skill` result JSON with a strict zod schema (`tools.ts:56-68`). Correct, and it makes resource reads depend on durable history, but it means a `load_skill` result larger than 65,536 chars can never satisfy a later `read_skill_resource` even if it was produced earlier. Not reachable because load rejects such results first.
- F7: `directoryName` must equal the skill `name` and be kebab-case (`skill_import.rs:~210-225`; `package.ts` via `validateSkillMetadata(…, directoryName)`). Users with "My Skill" folders get a path error. This is intentional per the PRD but is the first thing real users will hit; the error text is generic ("文件名不符合可移植路径要求").
- F8: `updatedAt` on `enable` only changes when the state flips (`installations.ts` `updateEntries`), so a no-op toggle is not visible in the catalogue. Fine; noted because a receipt is still written and `catalogue.revision` still advances.
- F9: `AGENT_SKILLS` builtin IDs are reserved against installed names (`installations.ts` `updateEntries`), but the reservation list is the static builtin list at install time; a future builtin added with a name an installed skill already uses is not handled (no migration path). Low likelihood.

## Security checklist

| Area | Result |
| --- | --- |
| Skill authority | None. `allowed-tools` is parsed as unsupported metadata and never consulted (`.trellis/spec/agent-core/library/skills.md` section 3). |
| Path confinement (native) | Closed envelope (`deny_unknown_fields`, no path), picker-only, one-shot, no persistent grant; per-entry lstat, same-volume check (`:~330, 408`), ancestor identity re-check, hard-link rejection (`verify_file`). Hidden and non-`references|assets` roots pruned without being opened. |
| Path confinement (logical) | `validateSkillImportPath` / `portable_path` reject `\ : < > " | ? *`, control and format chars, reserved device names, trailing dot/space, depth>4, NFC/case-fold duplicates — duplicated in Rust and TS and in the transport schema (`skillImport.ts:11-18`). Triple implementation is a drift risk (see F-comparison below) but they agree today. |
| Symlinks / TOCTOU | See F3/F4. No bypass found. |
| YAML | `failsafe` schema, `uniqueKeys`, `strict`, alias/tag/depth rejection before `toJS`, `maxAliasCount: 0` (`package.ts:40-58`). Sound. |
| Prompt injection | Skill body returned only as tool result with an explicit untrusted notice; the system prompt carries only escaped metadata (`formatSkillCatalogue`). Skills can still influence the model — by design. |
| Late response | Native pick: `epoch` invalidation + `busy` slot held until the real picker returns (`:~85-100`); late chooser result cannot install (UI test `installedSkillsUi.test.tsx:102`). |
| Uncertain commit | Operation ID + fingerprint with `lastOperation` receipts, conflict error on a changed catalogue, UI readback (`installations.ts:30-33, ~mutateSkills`; UI tests `:134-155`). |
| Concurrency | Single `rw` transaction per mutation with expected `catalogue.revision` CAS (`assertExpected`). Retention counts re-verified against catalogue on every read (`readSkillRetentions` throws on mismatch), which turns silent drift into a visible failure. |

## Test adequacy

Good: real ProductStore-backed suites for admission, retry, deletion rollback and tools; protocol tests for both model protocols; UI tests for uncertain writes.
Gaps: no test for F1 (browser tree with `.git` or a 1,100-file folder); no native test for a mid-capture swap or junction; compaction interplay not separately asserted; the 16 Rust skill_import test results are [claim-only].

## Comparison with dsh (read-only)

| Aspect | Ours (E09) | dsh | Assessment |
| --- | --- | --- | --- |
| Source model | One user-chosen directory, immutable snapshot, manual update, no watch | Multi-provider registry: local roots with precedence ranks, plugin/embedded, remote (`packages/skill/skill/src/index.ts:27-40`; `skill-filesystem/src/index.ts:261`) | Deliberately narrower. Ours trades discovery for determinism; there is no layered override, which also removes a shadowing attack surface that dsh needs `rank`/`source` to manage. |
| Trust model | Skill text is **untrusted** and is delivered only as a tool result | Skill body "embedded verbatim (skills are trusted local …)" (`skill/src/index.ts:165`) | Ours is stronger and fits an imported-from-anywhere skill. |
| Invocation policy | None per skill; model-visible if enabled | `modelInvocable` / `userInvocable` per skill, four combinations | Ours lacks a human-invoked slash path and a per-skill "hidden from the model" flag (out of scope per PRD, but a feature gap vs dsh). |
| Resource reading | Manifest-only logical names, paged by scalar, hashed rows | Reads from the real filesystem with `realpath` + sandbox containment (`skill-filesystem/src/index.ts:853-870`) | Ours cannot escape by construction (no path reaches the OS after import). dsh must defend with realpath at read time, which is the weaker structure but gives live files. |
| Versioning | Content-addressed revision, reference-counted, pinned per run | Re-validates the loaded definition and rejects a stale selection (README "on-demand loading") | Ours is stronger for replay and retry exactness; dsh is simpler and has no capacity pressure (F2). |
| Logic duplication | Path rules in Rust, TS package, TS transport schema and agent-core | Single provider path | Ours has more drift risk; a shared fixture list (as the tests partly do) is the only guard. |

## Recommended follow-ups

1. F1: make browser import apply the native exclusion pre-filter, and add a `.git` / 1,100-file test.
2. F2: add a retained-revision view and a way to release history content, or soften the cap.
3. F3: exclude (not abort on) reparse placeholders and excluded-file name errors in native capture, consistently with the browser.
4. Add a native swap/junction test and a single shared path-validity fixture across Rust/TS.
5. Run actual installed-UI acceptance (narrow layout, focus return, real picker) before ticking AC6.
