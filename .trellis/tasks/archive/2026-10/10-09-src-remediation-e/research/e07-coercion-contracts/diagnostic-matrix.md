# Exact historical entries mapped to current source

This is a source review, not fresh typed lint. One row per historical diagnostic; duplicate cover reads remain distinct. Matrix policies are defined in the sibling JSON/Markdown reports. The guarded primitive String(row.id) at codec:348 is outside these50 and already narrows primitives.

| Entry | Current source | Exact current line | Contract/recommendation policy |
| --- | --- | --- | --- |
| coercion-01 | src/db/database.ts:175 | `episodeId: String(record.episodeId ?? episodeId),` | db-episode-fk |
| coercion-02 | src/domain/slot.ts:28 | `slot.prompt = String(record.prompt ?? "");` | slot-prompt |
| coercion-03 | src/domain/slot.ts:40 | `mediaId: String(result.mediaId),` | slot-media |
| coercion-04 | src/domain/slot.ts:46 | `slot.result = {mediaId: String(legacyMediaId), kind: "image"};` | slot-media |
| coercion-05 | src/domain/types.ts:424 | `story.logline = String(record.logline ?? "");` | domain-prose |
| coercion-06 | src/domain/types.ts:436 | `id: String(beat.id ?? \`beat_${index}\`),` | domain-beat-id |
| coercion-07 | src/domain/types.ts:437 | `title: String(beat.title ?? ""),` | domain-prose |
| coercion-08 | src/domain/types.ts:438 | `content: String(beat.content ?? ""),` | domain-prose |
| coercion-09 | src/domain/types.ts:442 | `sceneId: beat.sceneId ? String(beat.sceneId) : undefined,` | domain-scene-fk |
| coercion-10 | src/domain/types.ts:443 | `timeOfDay: String(beat.timeOfDay ?? ""),` | domain-prose |
| coercion-11 | src/domain/types.ts:449 | `const excerpt = String(range.excerpt ?? "");` | domain-excerpt |
| coercion-12 | src/domain/types.ts:467 | `story.logline = String(record.logline ?? "");` | domain-prose |
| coercion-13 | src/domain/types.ts:468 | `story.script = String(record.script ?? "");` | domain-prose |
| coercion-14 | src/domain/types.ts:499 | `setting.worldview = String(record.worldview ?? "");` | domain-prose |
| coercion-15 | src/domain/types.ts:500 | `setting.background = String(record.background ?? "");` | domain-prose |
| coercion-16 | src/domain/types.ts:501 | `setting.rules = String(record.rules ?? "");` | domain-prose |
| coercion-17 | src/lib/agent/businessStore.ts:200 | `label: String(row.name ?? row.title ?? row.filename ?? row.shotNumber ?? row.id).slice(0, 200),` | agent-display |
| coercion-18 | src/lib/agent/businessStore.ts:201 | `excerpt: String(row.content ?? row.bio ?? row.notes ?? "").slice(0, 300), order: row.order` | agent-display |
| coercion-19 | src/lib/agent/businessStore.ts:207 | `const label = \`${BUSINESS_LABELS[kind]} · ${String(row.name ?? row.title ?? row.filename ?? row.shotNumber ?? row.id).slice(0, 120)}\`;` | agent-display |
| coercion-20 | src/lib/agent/businessStore.ts:330 | `label: String(row.name ?? row.shotNumber ?? row.id),` | agent-display |
| coercion-21 | src/lib/agent/businessTools.ts:296 | `labels.push(\`${String(row.name ?? row.title ?? row.filename ?? row.id)}（${row.id}）\`);` | agent-display |
| coercion-22 | src/lib/agent/businessTools.ts:812 | `changes: args.orderedIds.map((id, index) => \`${index + 1}. ${String(order.get(id)?.title ?? order.get(id)?.shotNumber ?? id)}\`)` | agent-display |
| coercion-23 | src/lib/agent/businessWriteReceipt.ts:36 | `revision, label: String(row.name ?? row.title ?? row.shotNumber ?? row.id).slice(0, 160)` | agent-display |
| coercion-24 | src/lib/agent/imageDiscovery.ts:42 | `const label = (value: unknown) => String(value ?? '').slice(0, 120);` | image-label |
| coercion-25 | src/lib/episodeDelivery.ts:92 | `columns.map((column) => [column.id, String(shot[column.id as keyof Shot] ?? "")]),` | delivery-column |
| coercion-26 | src/lib/episodeDelivery.ts:136 | `const text = String(value ?? "");` | csv-cell |
| coercion-27 | src/lib/packages/projectPackageCodec.ts:122 | `raw.coverMediaId != null && String(raw.coverMediaId).trim()` | package-cover |
| coercion-28 | src/lib/packages/projectPackageCodec.ts:123 | `? String(raw.coverMediaId)` | package-cover |
| coercion-29 | src/lib/packages/projectPackageCodec.ts:128 | `id: String(raw.id ?? createId("prj")),` | package-identity |
| coercion-30 | src/lib/packages/projectPackageCodec.ts:129 | `name: String(raw.name ?? fallbackName),` | package-name |
| coercion-31 | src/lib/packages/projectPackageCodec.ts:139 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-32 | src/lib/packages/projectPackageCodec.ts:140 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-33 | src/lib/packages/projectPackageCodec.ts:202 | `id: String(raw.id ?? createId("chr")),` | package-identity |
| coercion-34 | src/lib/packages/projectPackageCodec.ts:207 | `name: String(raw.name ?? "未命名角色"),` | package-name |
| coercion-35 | src/lib/packages/projectPackageCodec.ts:208 | `bio: String(raw.bio ?? ""),` | package-prose |
| coercion-36 | src/lib/packages/projectPackageCodec.ts:209 | `appearance: String(raw.appearance ?? ""),` | package-prose |
| coercion-37 | src/lib/packages/projectPackageCodec.ts:210 | `notes: String(raw.notes ?? ""),` | package-prose |
| coercion-38 | src/lib/packages/projectPackageCodec.ts:212 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-39 | src/lib/packages/projectPackageCodec.ts:213 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-40 | src/lib/packages/projectPackageCodec.ts:238 | `id: String(raw.id ?? createId("scn")),` | package-identity |
| coercion-41 | src/lib/packages/projectPackageCodec.ts:242 | `name: String(raw.name ?? "未命名场景"),` | package-name |
| coercion-42 | src/lib/packages/projectPackageCodec.ts:243 | `location: String(raw.location ?? ""),` | package-prose |
| coercion-43 | src/lib/packages/projectPackageCodec.ts:244 | `timeOfDay: String(raw.timeOfDay ?? ""),` | package-prose |
| coercion-44 | src/lib/packages/projectPackageCodec.ts:245 | `atmosphere: String(raw.atmosphere ?? ""),` | package-prose |
| coercion-45 | src/lib/packages/projectPackageCodec.ts:246 | `notes: String(raw.notes ?? ""),` | package-prose |
| coercion-46 | src/lib/packages/projectPackageCodec.ts:248 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-47 | src/lib/packages/projectPackageCodec.ts:249 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-48 | src/lib/packages/projectPackageCodec.ts:274 | `id: String(raw.id ?? createId("prp")),` | package-identity |
| coercion-49 | src/lib/packages/projectPackageCodec.ts:281 | `name: String(raw.name ?? "未命名道具"),` | package-name |
| coercion-50 | src/lib/packages/projectPackageCodec.ts:282 | `kind: String(raw.kind ?? ""),` | package-prose |
| coercion-51 | src/lib/packages/projectPackageCodec.ts:283 | `notes: String(raw.notes ?? ""),` | package-prose |
| coercion-52 | src/lib/packages/projectPackageCodec.ts:285 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-53 | src/lib/packages/projectPackageCodec.ts:286 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-54 | src/lib/packages/projectPackageCodec.ts:310 | `id: String(raw.id ?? createId("sty")),` | package-identity |
| coercion-55 | src/lib/packages/projectPackageCodec.ts:317 | `name: String(raw.name ?? "未命名风格"),` | package-name |
| coercion-56 | src/lib/packages/projectPackageCodec.ts:318 | `notes: String(raw.notes ?? ""),` | package-prose |
| coercion-57 | src/lib/packages/projectPackageCodec.ts:320 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-58 | src/lib/packages/projectPackageCodec.ts:321 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-59 | src/lib/packages/projectPackageCodec.ts:400 | `id: String(raw.id ?? createId("ep")),` | package-identity |
| coercion-60 | src/lib/packages/projectPackageCodec.ts:403 | `title: String(raw.title ?? ""),` | package-prose |
| coercion-61 | src/lib/packages/projectPackageCodec.ts:408 | `createdAt: String(raw.createdAt ?? at),` | package-time |
| coercion-62 | src/lib/packages/projectPackageCodec.ts:409 | `updatedAt: String(raw.updatedAt ?? at),` | package-time |
| coercion-63 | src/lib/packages/projectPackageCodec.ts:469 | `id: String(raw.id ?? createId("sht")),` | package-identity |
| coercion-64 | src/lib/packages/projectPackageCodec.ts:471 | `episodeId: String(raw.episodeId ?? episodeId),` | package-episode-fk |
| coercion-65 | src/lib/packages/projectPackageCodec.ts:473 | `shotNumber: String(raw.shotNumber ?? index + 1),` | package-shot-number |
| coercion-66 | src/lib/packages/projectPackageCodec.ts:480 | `category: String(raw.category ?? ""),` | package-prose |
| coercion-67 | src/lib/packages/projectPackageCodec.ts:482 | `content: String(raw.content ?? ""),` | package-prose |
| coercion-68 | src/lib/packages/projectPackageCodec.ts:483 | `notes: String(raw.notes ?? ""),` | package-prose |
| coercion-69 | src/lib/packages/projectPackageCodec.ts:484 | `sceneCloseup: String(raw.sceneCloseup ?? ""),` | package-prose |
| coercion-70 | src/lib/packages/projectPackageCodec.ts:485 | `sound: String(raw.sound ?? ""),` | package-prose |
| coercion-71 | src/lib/packages/projectPackageCodec.ts:486 | `emotion: String(raw.emotion ?? ""),` | package-prose |
| coercion-72 | src/lib/packages/projectPackageCodec.ts:487 | `cameraAngle: String(raw.cameraAngle ?? ""),` | package-prose |
| coercion-73 | src/lib/packages/projectPackageCodec.ts:488 | `cameraGear: String(raw.cameraGear ?? ""),` | package-prose |
| coercion-74 | src/lib/packages/projectPackageCodec.ts:489 | `focalLength: String(raw.focalLength ?? ""),` | package-prose |
| coercion-75 | src/lib/packages/projectPackageCodec.ts:493 | `sceneId: raw.sceneId ? String(raw.sceneId) : undefined,` | package-optional-fk |
| coercion-76 | src/lib/packages/projectPackageCodec.ts:494 | `beatId: raw.beatId ? String(raw.beatId) : undefined,` | package-optional-fk |
