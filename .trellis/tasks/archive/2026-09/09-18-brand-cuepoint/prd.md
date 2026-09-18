# Brand as 小光点 Cuepoint

## Problem

The working title「爱分镜 / aifenjing」was temporary. The product brand is now **小光点** (CN) / **Cuepoint** (EN). An empty GitHub repo exists at https://github.com/ROYIANS/Cuepoint and should become the remote.

## Goals

- User-facing surfaces show **小光点** / **Cuepoint**, not 爱分镜.
- npm package / repo identity align with Cuepoint where safe.
- Existing local IndexedDB data and exported project zips keep working without migration.
- Local clone gains `origin` → `ROYIANS/Cuepoint` and can push `main`.

## Non-goals

- Renaming the local folder `aifenjing`.
- Changing IndexedDB database name `aifenjing`.
- Changing export format id `aifenjing-project-v1` (or requiring re-export of old packs).
- Full marketing site, logo redesign, or domain purchase.
- Rewriting archived Trellis task docs.

## Requirements

- **R1** Document title and any primary product chrome use 小光点; English product name is Cuepoint where an English identifier is needed (`package.json` `name`, README title).
- **R2** User-visible error/copy that says「爱分镜」is updated to「小光点」(e.g. invalid package message).
- **R3** Spec overview that names the product refers to 小光点 Cuepoint.
- **R4** Storage/package wire IDs stay: Dexie DB name `aifenjing`, class can be renamed for clarity only if DB name string is unchanged; `PACKAGE_FORMAT` remains `aifenjing-project-v1`.
- **R5** Git remote `origin` points at `https://github.com/ROYIANS/Cuepoint.git`; `main` is pushed once brand commits land (empty remote).

## Acceptance criteria

- [ ] `index.html` title is 小光点 (optionally with Cuepoint subtitle only if natural).
- [ ] `package.json` `"name"` is `cuepoint`.
- [ ] No user-facing「爱分镜」remains under `src/` or `index.html`.
- [ ] Import still accepts `aifenjing-project-v1`; tests still pass.
- [ ] `origin` is the Cuepoint GitHub repo; push succeeds or is blocked only by auth (then report).
- [ ] Short README exists for the GitHub empty repo (product name + one-line description).

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| CN brand | 小光点 |
| EN brand | Cuepoint |
| DB / package format ids | Keep `aifenjing` / `aifenjing-project-v1` |
| GitHub | https://github.com/ROYIANS/Cuepoint |
| Local folder name | Unchanged |
