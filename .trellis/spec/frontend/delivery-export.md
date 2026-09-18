# Delivery Export

## Scenario: Episode CSV and printable storyboard

### 1. Scope / Trigger

Use when deriving production readiness or user-facing deliverables from an episode. Delivery rows are derived, never persisted.

### 2. Signatures

```ts
deriveEpisodeDelivery(input: {
  project: Project;
  episode: Episode;
  shots: Shot[];
  characters: Character[];
  scenes: Scene[];
}): EpisodeDelivery

episodeDeliveryCsv(delivery: EpisodeDelivery): string
episodeDeliveryFilename(delivery: EpisodeDelivery): string
```

Print route:

```text
/p/$projectId/e/$episodeId/storyboard
```

### 3. Contracts

- Filter shots by both `project.id` and `episode.id`, then sort by stored shot order.
- Do not enable export until shots and referenced assets have finished loading.
- CSV starts with a UTF-8 BOM, uses comma delimiters, CRLF rows, and doubles quotes inside quoted cells.
- Delivery includes base columns plus currently visible optional shot columns.
- Shot `status` is always exported (Chinese label in CSV / print). Missing or unknown values normalize to `draft` / 草稿.
- Printable visual fallback is first-frame result, then last-frame result, then an empty placeholder.
- Print CSS uses A4 landscape and removes application chrome.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Foreign project/episode shot | Exclude from delivery |
| Asset query still loading | Disable CSV/print actions |
| Missing character/scene target | Render an explicit unknown-ID label |
| Filename contains filesystem punctuation | Replace punctuation with `-` |
| Cell contains comma, quote, CR, or LF | Quote cell and double inner quotes |

### 5. Good/Base/Bad Cases

- Good: episode 2 CSV contains only episode 2 shots in visible order
- Base: a shot without media prints a stable empty visual
- Bad: treat project ZIP as a client-facing shot-list export

### 6. Tests Required

- Cross-project and cross-episode filtering
- Ordering, total duration, readiness gaps, and media fallback
- Chinese, comma, quote, and multiline CSV cells
- Filename sanitization and UTF-8 BOM
- Route rejects an episode owned by another project

### 7. Wrong vs Correct

#### Wrong

```ts
const rows = shots.filter((shot) => shot.projectId === project.id);
```

#### Correct

```ts
const rows = shots.filter(
  (shot) => shot.projectId === project.id && shot.episodeId === episode.id,
);
```
