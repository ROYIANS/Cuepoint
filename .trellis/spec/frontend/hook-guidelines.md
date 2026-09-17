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

---

## Naming Conventions

- Page-level live queries stay inline; extract a `use*` hook only when a second caller needs the same query.
- Repo functions are `add*` / `patch*` / `delete*` / `set*Slot`, not hooks.

---

## Common Mistake: Dexie get loading collapse

**Symptom**: `/characters/chr_does-not-exist` shows 加载中… forever.

**Cause**: `undefined` used for both loading and missing.

**Fix**: `?? null` in the liveQuery callback.
