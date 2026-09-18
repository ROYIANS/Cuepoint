# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Data reads go through Dexie `useLiveQuery`. Mutations go through `src/db/repo.ts`. Do not fetch records with one-shot `useEffect` + `db.*.get` if the page should update after edits.

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

---

## Naming Conventions

- Page-level live queries stay inline; extract a `use*` hook only when a second caller needs the same query.
- Repo functions are `add*` / `patch*` / `delete*` / `set*Slot`, not hooks.

---

## Common Mistake: Dexie get loading collapse

**Symptom**: `/characters/chr_does-not-exist` shows 加载中… forever.

**Cause**: `undefined` used for both loading and missing.

**Fix**: `?? null` in the liveQuery callback.
