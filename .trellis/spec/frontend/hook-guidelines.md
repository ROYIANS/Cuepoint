# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Data reads go through Dexie `useLiveQuery`. Mutations go through the concrete business command owner under `src/db/` (for example `shots.ts`, `assets.ts`, `chat.ts`, or `cascadeCommands.ts`); the D02 ownership table is in [State Management](./state-management.md). Do not fetch records with one-shot `useEffect` + `db.*.get` if the page should update after edits.

---

## Data Fetching

### Dexie `get()` vs liveQuery loading

`Table.get(id)` returns `undefined` when the row is missing. `useLiveQuery` also returns `undefined` while the query has not resolved.

If you write:

```ts
const row = useLiveQuery(() => db.characters.get(id), [id]);
if (row === undefined) return <Loading />;
if (!row) return <NotFound />;
```

the not-found branch never runs. Missing ids stay on 加载中 forever.

**Contract**: coerce missing rows to `null` inside the query.

```ts
const character = useLiveQuery(
  async () => (await db.characters.get(characterId)) ?? null,
  [characterId],
);

if (character === undefined) return <div>加载中…</div>;
if (character === null) return <div>找不到这个角色</div>;
```

| Query result | Meaning |
| --- | --- |
| `undefined` | liveQuery still loading |
| `null` | loaded, no row |
| object | loaded row |

This applies to `characters`, `scenes`, `props`, `styles`, `episodes`, `projects`, and any other `db.*.get` detail page.

### Changed query dependencies

`useLiveQuery` can retain its previous result while a new dependency set loads. If downstream actions rely on loading being complete, include the dependency identity in the query result and return `undefined` until it matches the current identity. `useShotMedia` keys its result by the sorted result-media IDs so gap filters and locate-shot navigation cannot treat the previous episode's media collection as loaded.

Identity belongs to the query result even when it contains `null` or an empty array. A returned row's `id` alone cannot distinguish an old missing/empty read from a newly requested read. Tag owner/project and entity/episode dependencies in the querier, then gate navigation, repair effects, mutation controls and export until the envelope matches. Validate returned ownership as well; matching requested envelope identity does not authorize a foreign row.

For stateful project/episode/asset pages, put a stable key before the component that calls queries and initializes local drafts. Use project, project+episode, or owner+entity identity as appropriate. Focus/search and unrelated live updates are not editing-target identity. A project-level key does not replace an episode envelope in a persistent Chrome component. Same-project episode loading must keep its project settings and Outlet mounted while hiding the old episode's links.

A key can destroy manual drafts. Install dirty/pending route and unload protection before relying on remount, and resolve internal parent-driven selection separately (for example material selection does not navigate). Preserve existing frozen target/baseline protocols. See the B01 scenario in state-management for explicit-discard and unavailable-record behavior.


---

## Naming Conventions

- Page-level live queries stay inline; extract a `use*` hook only when a second caller needs the same query.
- Repo functions are `add*` / `patch*` / `delete*` / `set*Slot`, not hooks.

---

## Common Mistake: Dexie get loading collapse

**Symptom**: `/characters/chr_does-not-exist` shows 加载中… forever.

**Cause**: `undefined` used for both loading and missing.

**Fix**: `?? null` in the liveQuery callback.

## B06: editor-scoped async completion (2026-09-30)

### 1. Scope / trigger

Connector probe/test and script File.text reads may finish after close/reopen, credentials change, text edit or unmount. A completion must belong to its initiating editor/request, including error and finally paths. Local component refs are sufficient; this contract does not require a global async operation registry.

### 2. Signatures

Keep existing `ConnectorsPage` handlers and provider signatures: `listConnectorModels(connector, usage?, fetchImpl?)` and `testConnectorConnection(connector, fetchImpl?)` have no AbortSignal API. Guard publication locally without redesigning their transport. `StoryEditor.applyScriptFile(file: File)` captures episode ownership, request sequence and script edit revision; `DraftStatus.onUseLatest` participates in that lifetime. Alias an ordinary returned `useLatest` action as `adoptLatestDraft` when calling it behind guards, so Hook naming tools do not mistake it for a conditional React Hook.

### 3. Contracts

Capture frozen connector definition/credentials at invocation. Only the current mounted editor/credential request may publish models, toast or clear its busy flag. Closing/changing credentials invalidates a read; a later request's busy state must survive the old finally. Save/disconnect are synchronous single-writer operations: refuse direct duplicate callbacks, credential edits, dismissal and opening another editor while pending. On failure retain the form; publication after unmount is suppressed. Mount effect setup must restore lifetime state after cleanup/setup replay.

For script reads, newest request wins. Increment script revision on every manual edit, including edit-then-revert. A successful latest read can apply only if the initiating script revision is unchanged; otherwise preserve current text and expose an imported candidate for explicit adopt/discard. Unrelated title/logline edits survive import. New reads supersede prior candidates; read failure preserves the draft and permits retry. Use latest, scope change and unmount invalidate pending reads/candidates. Preserve filename/MIME acceptance and no automatic scene splitting.

### 4. Validation / error matrix

| Completion or action | Expected outcome |
| --- | --- |
| Old editor/credentials success or rejection | No models, toast or busy release in new session |
| Test's nested model read becomes obsolete | No stale models or later success publication |
| Two writes invoked before rerender | Only first repository operation starts |
| Save/disconnect pending dismissal/edit/open | Guard rejects, matching controls disabled |
| Current write rejects | Visible error, form retained, current operation released |
| File A then B returns in either order | Only latest B can apply/be offered |
| Latest file returns after script edit/revert | Candidate, current text unchanged |
| Import after title-only edit | Script may apply; edited title preserved |
| Read fails or component unmounts | No overwrite; error only in live matching session |
| Explicit use latest | Pending import/candidate retired before baseline adoption |

### 5. Good / base / bad cases

Good: close probe A, open editor B, start B; A finally cannot clear B's busy state. Base: unchanged script accepts a supported file normally. Bad: `setDraft(current => ({...current, script: await file.text()}))` with no initiating revision, or using an unconditional finally to clear shared pending.

### 6. Required tests

Execute actual production component callbacks with deferred provider/File promises: both orders, credential change, nested test/list, same-render duplicate writes, pending dismissal and failure, unmount and effect replay. Verify script newer text, edit/revert, title-only edit, adopt/discard and useLatest, including captured old candidate callbacks after a replacement candidate appears. Advance the production debounce timeout and assert the actual repository write, rather than testing only Retry/flush callbacks. A mocked hook/JSX host verifies callback lifetimes, not real Radix or browser scheduling; state the distinction in evidence.

### 7. Wrong vs correct

Wrong: reset busy on close, then let any old promise update shared form state. Correct: invalidate the read's owner synchronously, freeze input and check owner at every publication/finally. Writes use a separate synchronous pending lock and retain their initiating form until settlement.


## Feature hook ownership

`useChatExecutionSession` owns the synchronous execution mutex, AbortController and token release lifetime. `useChatSelection` owns current field identity/revision reconciliation. `useShotEditorKeyboard` owns the capture listener and latest typed input callbacks. Consume stable returned functions/refs with truthful Hook dependencies; a ref returned by another hook is not automatically recognized as a locally stable ref by the lint rule. Abort/effect replay does not release the execution lock before transport final flush. See [the D03 feature contract](./component-guidelines.md#d03-feature-responsibility-contract-2026-10-08).

## Coherent context preview ownership

Chat preview has one live subscription at ContextUsageTrigger and a complete input-identity gate. Its panel, ring and memory preview consume the same snapshot. Policy/memory management queries retain their own scope envelopes and current availability; old results/callbacks cannot publish in another thread. See [the D04 coherent-preview contract](./agent-context.md#d04-coherent-preview-snapshot-contract-2026-10-08).

Shot/beat text retention follows `state-management.md` D08. `useTextDraftRetention` keeps readable pending rows; synchronous status refs protect the input event and actual pending-ID state participates in memo invalidation. Existing debouncedDraft owns timers, baselines, retry and persistence. Avoid dummy revision dependencies or a second draft store.
