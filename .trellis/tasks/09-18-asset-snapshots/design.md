# Design — 项目世界与工作室资产快照

## Copy Contract

Copy-on-add creates a new asset ID and new media records owned by the destination project. Preserve source metadata as optional `sourceAssetId` inside `extra`; it is informational only.

Copy asset and media in one Dexie transaction. Deduplicate source media within one copied asset so repeated slot references map to one destination media record.

## UI

Each project world tab offers “从工作室添加” and shows a multi-select picker excluding assets already copied from the same source. Local creation remains available.

Reuse existing detail components and routes for project props/styles.

## Package

`props.json` and `styles.json` remain optional v1 members. Import remaps their IDs and slot media exactly like characters/scenes. Studio-owned records are never included.

## Rollback

Deleting a newly copied snapshot deletes only project-owned records and orphan media; source studio data is untouched.
