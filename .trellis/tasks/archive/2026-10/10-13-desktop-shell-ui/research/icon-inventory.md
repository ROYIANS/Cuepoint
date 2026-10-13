# Research: Common UI icon inventory and Remix semantic mapping

- Query: Inventory application-owned Lucide/general UI icons and propose verified official Remix replacements, retaining model/provider brand icons.
- Scope: mixed — source inventory, installed third-party renderers, official package/API references.
- Date: 2026-10-13

## Findings

### Baseline and scope

- Baseline before migration: **79 src files**, **119 distinct imported names**, **364 import occurrences** from `lucide-react`. Names include equivalent suffix aliases such as Check/CheckIcon and ChevronDown/ChevronDownIcon; treat them as the same semantic icon.
- No direct `@ant-design/icons` application imports, no application `LucideIcon`/`LucideProps` or `absoluteStrokeWidth` references. LobeHub internal dependencies still use Lucide and have their own renderer contracts.
- Current global navigation mixes Lucide outlines with seven local filled SVG shapes, accounting for the line/fill discrepancy. Use paired official Remix variants for each nav destination and remove that custom shape mapping.
- Model/provider icons remain in `DemandModelIcons.tsx`, `ModelIcons.tsx` and generated `ModelIconMapping.generated.ts`; these are brand matching/lazy-load owners and are outside common UI replacement.
- Custom waveform and usage-meter SVG are data visualizations, not icon-package consumers: retain their paths and strokes.

### Files found and migration ownership

| Group | Baseline files | Responsibility |
| --- | ---: | --- |
| `agent` | 29 | Agent headers, topics, composer, model controls, task UI, results/references |
| `assets` | 5 | Asset details and library actions |
| `audio` | 9 | Audio timeline, recording, inspector, libraries and exports |
| `audioMusic` | 2 | Shared playback/export controls |
| `layout` | 1 | AppFrame global navigation and mobile menu |
| `memory` | 2 | Project memory actions and empty states |
| `music` | 2 | Music workspace/creation controls |
| `produce` | 3 | Production, print and proposals actions |
| `shots` | 2 | Shot list/editor actions and drag handles |
| `slots` | 1 | Generation-slot controls |
| `story` | 1 | Script ordering/duplicate actions |
| `studio` | 15 | Libraries, projects, IP, connectors, media and card actions |
| `ui` | 5 | Radix/shadcn primitive indicators and close/check arrows |
| `workspace` | 2 | Project header and episode list |

Recommended parallel split: shared adapter/package + layout/ui/studio/workspace/assets/slots/story/produce/shots/memory owner; Agent/audio/audioMusic/music consumer owner. The adapter contract must land first; workers should coordinate it without rewriting business logic. If existing worker ownership differs, follow the actual dispatch.

Application consumer paths captured during inventory (concurrent migration may already have replaced imports):

- **agent** — `src/components/agent/AgentComposerAttention.tsx`, `src/components/agent/AgentControls.tsx`, `src/components/agent/AgentGenerationBatches.tsx`, `src/components/agent/AgentGenerationResults.tsx`, `src/components/agent/AgentHeader.tsx`, `src/components/agent/AgentRunDetails.tsx`, `src/components/agent/AgentTopicNavigation.tsx`, `src/components/agent/AgentWriteOutcomes.tsx`, `src/components/agent/ChatWorkspace.tsx`, `src/components/agent/ContextCompactionDetails.tsx`, `src/components/agent/ContextParameters.tsx`, `src/components/agent/ContextUsagePanel.tsx`, `src/components/agent/FloatingComposer.tsx`, `src/components/agent/GenerationReview.tsx`, `src/components/agent/HomeWelcome.tsx`, `src/components/agent/MemoryContextDetails.tsx`, `src/components/agent/MessageList.tsx`, `src/components/agent/ModelSelectTrigger.tsx`, `src/components/agent/ModelSettingsMenu.tsx`, `src/components/agent/MusicGenerationReview.tsx`, `src/components/agent/ProjectPicker.tsx`, `src/components/agent/ReferenceAttachments.tsx`, `src/components/agent/ReferenceLibrary.tsx`, `src/components/agent/TaskBoard.tsx`, `src/components/agent/TaskInspector.tsx`, `src/components/agent/TaskRecords.tsx`, `src/components/agent/TaskWrapup.tsx`, `src/components/agent/ThinkingPanel.tsx`, `src/components/agent/TopicSidebar.tsx`.
- **assets** — `src/components/assets/AssetLibraryPage.tsx`, `src/components/assets/CharacterDetailPage.tsx`, `src/components/assets/PropDetailPage.tsx`, `src/components/assets/SceneDetailPage.tsx`, `src/components/assets/StyleDetailPage.tsx`.
- **audio** — `src/components/audio/AudioExports.tsx`, `src/components/audio/AudioInspector.tsx`, `src/components/audio/AudioSources.tsx`, `src/components/audio/AudioTimeline.tsx`, `src/components/audio/AudioWorkspacePage.tsx`, `src/components/audio/ScriptDocument.tsx`, `src/components/audio/SpeechControls.tsx`, `src/components/audio/VoiceLibrary.tsx`, `src/components/audio/VoiceReferencePicker.tsx`.
- **audioMusic** — `src/components/audioMusic/controls.tsx`, `src/components/audioMusic/shared.tsx`.
- **layout** — `src/components/layout/AppFrame.tsx`.
- **memory** — `src/components/memory/MemoryPromotion.tsx`, `src/components/memory/ProjectMemoryPage.tsx`.
- **music** — `src/components/music/MusicCreation.tsx`, `src/components/music/MusicWorkspacePage.tsx`.
- **produce** — `src/components/produce/ProducePage.tsx`, `src/components/produce/ProductionProposalsPanel.tsx`, `src/components/produce/StoryboardPrintPage.tsx`.
- **shots** — `src/components/shots/ShotEditorPage.tsx`, `src/components/shots/ShotRow.tsx`.
- **slots** — `src/components/slots/GenerationSlotCard.tsx`.
- **story** — `src/components/story/StoryPage.tsx`.
- **studio** — `src/components/studio/AboutPage.tsx`, `src/components/studio/AssetLibraryPages.tsx`, `src/components/studio/ConnectorsPage.tsx`, `src/components/studio/CoverCard.tsx`, `src/components/studio/IpProfileEditor.tsx`, `src/components/studio/IpProfilesPage.tsx`, `src/components/studio/LibraryHeader.tsx`, `src/components/studio/MaterialLibraryPage.tsx`, `src/components/studio/ProjectGalleryPage.tsx`, `src/components/studio/StudioShell.tsx`, `src/components/studio/materials/LegacyMaterialSources.tsx`, `src/components/studio/materials/MaterialDetailPanel.tsx`, `src/components/studio/materials/MaterialImportDialog.tsx`, `src/components/studio/materials/MaterialPreview.tsx`, `src/components/studio/projectKinds.tsx`.
- **ui** — `src/components/ui/checkbox.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/select.tsx`, `src/components/ui/sheet.tsx`.
- **workspace** — `src/components/workspace/EpisodeListPage.tsx`, `src/components/workspace/WorkspaceChrome.tsx`.

Additional owners:

- `src/components/layout/SelectedNavIcon.tsx` — seven hand-built active navigation SVGs; replace/remove once NAV directly pairs Remix Line/Fill.
- `src/components/agent/DemandModelIcons.tsx:2` — publisher-specific ModelIcon/ProviderIcon fallback and brand loaders; retain.
- `src/components/agent/ModelIconMapping.generated.ts` — generated brand matching order/import paths; retain.
- `package.json:50` — existing Lucide package declaration; use official `@remixicon/react` runtime dependency.
- `tests/fixtures/sourceSnapshots/e02/TopicSidebar.tsx:15`, `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/ProjectGalleryPage.tsx:46`, `tests/fixtures/sourceSnapshots/e04-library/src/components/studio/projectKinds.tsx:1` — immutable comparison sources still import Lucide. Retain its direct dev dependency so these harnesses resolve reproducibly; do not edit snapshots.

### Render patterns and compatibility traps

- `src/components/layout/AppFrame.tsx:16` and `:49`: NAV holds route predicate/icon components; selected presentation currently switches to SelectedNavIcon. Retain predicates (especially `/agent/tasks`) and labels while switching paired components.
- `src/components/agent/AgentHeader.tsx:34`, `AgentTopicNavigation.tsx:1`, `TopicSidebar.tsx:58`, `ModelSelectTrigger.tsx:288`: LobeHub ActionIcon accepts a component. Existing consumers cannot all be replaced with raw Remix components blindly.
- **Critical fill trap:** installed `node_modules/@lobehub/ui/es/Icon/Icon.mjs:9` defaults `fill="transparent"`; lines 18–28 forward fill, strokeWidth, height/width/size and ref. Official Remix runtime sets `fill=color` and then spreads incoming props, so that transparent value overrides the real glyph fill. A common adapter must ignore incoming `fill`, Lucide stroke options and redundant sizing, preserve `color`/className/ref/accessibility, and render the official path with its intended color. Alternatively every Lobe caller would need an explicit valid fill, which is harder to maintain. Do not fix this with a global fill CSS rule.
- Official `node_modules/@remixicon/react/index.d.ts:8` reserves fill/width/height/viewBox; public Props provide `size` and `color`. The declared type is ComponentType, so check ref forwarding against installed runtime rather than assuming a Lucide ForwardRefExoticComponent.
- `src/components/agent/TopicSidebar.tsx:232` includes `{size?:number;strokeWidth?:number}` in its component prop contract; remove the obsolete stroke prop or use the shared adapter props.
- `src/components/layout/AppFrame.tsx:49,73`, `ProjectMemoryPage.tsx:133,161`, `IpProfilesPage.tsx:162,175,178,197`, `studio/projectKinds.tsx:55`, `TaskWrapup.tsx:388`, `TopicSidebar.tsx:243`, `ChatWorkspace.tsx:110`, `MemoryContextDetails.tsx:244`, `TaskRecords.tsx:196`, `TaskBoard.tsx:112`, `ConnectorsPage.tsx:262` customize Lucide stroke weight. Remix Line is already a filled outlined geometry; discard those stroke tweaks while preserving icon size.
- `src/components/studio/materials/materialLibrary.css:1` has `.material-preview>svg{...stroke-width:1.25}`. Remove that icon-specific stroke weight to avoid implying a supported Remix stroke setting. Existing width/height/color/rotation rules remain useful.
- `src/components/agent/ContextUsagePanel.tsx:378` is a two-circle usage meter with strokeDasharray; preserve it. `src/components/audio/AudioTimeline.tsx:678` is the waveform rendering, preserve it. These cannot be converted to generic icons.
- LobeHub loading/ChatItem/default internals still render dependency-owned Lucide symbols. Replacing all dependency internals would require component overrides or a separate redesign; do not patch node_modules or misreport them as application imports.

### Verified semantic mapping

Every target below exists in the official **@remixicon/react 4.9.0** declaration file. The table is a semantic migration guide; aliases need not remain the public names of the final icon module. Use official Line/Fill pairs for selected states.

| Current imported name | Remix candidate | Notes |
| --- | --- | --- |
| `AlertTriangle` | `RiAlertLine` |  |
| `Archive` | `RiArchiveLine` |  |
| `ArrowDown` | `RiArrowDownLine` |  |
| `ArrowLeft` | `RiArrowLeftLine` |  |
| `ArrowRight` | `RiArrowRightLine` |  |
| `ArrowUp` | `RiArrowUpLine` |  |
| `ArrowUpRight` | `RiArrowRightUpLine` |  |
| `BookOpen` | `RiBookOpenLine` |  |
| `Boxes` | `RiBox3Line` |  |
| `Cable` | `RiPlug2Line` |  |
| `Check` | `RiCheckLine` |  |
| `CheckCheck` | `RiCheckDoubleLine` |  |
| `CheckCircle2` | `RiCheckboxCircleLine` |  |
| `CheckIcon` | `RiCheckLine` |  |
| `CheckSquare` | `RiCheckboxLine` |  |
| `ChevronDown` | `RiArrowDownSLine` |  |
| `ChevronDownIcon` | `RiArrowDownSLine` |  |
| `ChevronLeft` | `RiArrowLeftSLine` |  |
| `ChevronRight` | `RiArrowRightSLine` |  |
| `ChevronRightIcon` | `RiArrowRightSLine` |  |
| `ChevronUp` | `RiArrowUpSLine` |  |
| `ChevronUpIcon` | `RiArrowUpSLine` |  |
| `Circle` | `RiCheckboxBlankCircleLine` |  |
| `CircleAlert` | `RiErrorWarningLine` |  |
| `Clapperboard` | `RiClapperboardLine` |  |
| `ClipboardCheck` | `RiTaskLine` |  |
| `Coins` | `RiCoinsLine` |  |
| `Columns3` | `RiLayoutColumnLine` |  |
| `Copy` | `RiFileCopyLine` |  |
| `CopyPlus` | `RiFileCopy2Line` | FileCopy2 communicates duplicate; preserve the create/duplicate text because there is no exact add-copy counterpart. |
| `Download` | `RiDownloadLine` |  |
| `Ellipsis` | `RiMoreLine` |  |
| `Expand` | `RiFullscreenLine` |  |
| `ExternalLink` | `RiExternalLinkLine` |  |
| `Eye` | `RiEyeLine` |  |
| `FileText` | `RiFileTextLine` |  |
| `Filter` | `RiFilter3Line` |  |
| `Folder` | `RiFolderLine` |  |
| `FolderOpen` | `RiFolderOpenLine` |  |
| `Gauge` | `RiSpeedUpLine` |  |
| `GripVertical` | `RiDraggable` | Draggable has no Line/Fill suffix. It is an official standalone system glyph. |
| `Hand` | `RiHand` | Hand has no Line/Fill suffix. It is an official standalone system glyph. |
| `Hash` | `RiHashtag` | Hashtag has no Line/Fill suffix. |
| `Headphones` | `RiHeadphoneLine` |  |
| `Heart` | `RiHeartLine` |  |
| `History` | `RiHistoryLine` |  |
| `Image` | `RiImageLine` |  |
| `ImageIcon` | `RiImageLine` |  |
| `Images` | `RiMultiImageLine` |  |
| `Infinity` | `RiInfinityLine` |  |
| `Info` | `RiInformationLine` |  |
| `Layers` | `RiStackLine` |  |
| `Layers3` | `RiStackLine` |  |
| `LayoutList` | `RiListView` | ListView has no Line/Fill suffix. |
| `Library` | `RiBookShelfLine` |  |
| `ListChecks` | `RiTodoLine` |  |
| `ListMusic` | `RiPlayListLine` |  |
| `ListTodo` | `RiTodoLine` |  |
| `LoaderCircle` | `RiLoader4Line` |  |
| `Magnet` | `RiFocus2Line` | No magnet export exists in 4.9.0. Focus2 is an intentional substitute for timeline snapping; keep label and aria-pressed. |
| `Maximize2` | `RiExpandDiagonalLine` |  |
| `Menu` | `RiMenuLine` |  |
| `MessageSquare` | `RiChat3Line` |  |
| `MessageSquarePlus` | `RiChatNewLine` |  |
| `MessagesSquare` | `RiQuestionAnswerLine` |  |
| `Mic` | `RiMicLine` |  |
| `Mic2` | `RiMic2Line` |  |
| `Minimize2` | `RiCollapseDiagonalLine` |  |
| `Minus` | `RiSubtractLine` |  |
| `MoreHorizontal` | `RiMoreLine` |  |
| `Music2` | `RiMusic2Line` |  |
| `PackageOpen` | `RiBox3Line` |  |
| `PanelLeft` | `RiSideBarLine` |  |
| `PanelLeftClose` | `RiSidebarFoldLine` |  |
| `PanelRightClose` | `RiSidebarFoldLine` | Mirror the SidebarFold glyph horizontally to keep a right sidebar and rightward close arrow, or visually select a corresponding menu-fold variant. |
| `PanelRightOpen` | `RiSidebarUnfoldLine` | Mirror SidebarUnfold horizontally for a right sidebar; preserve the existing inspector toggle label. |
| `Paperclip` | `RiAttachmentLine` |  |
| `Pause` | `RiPauseLine` |  |
| `PenLine` | `RiQuillPenLine` |  |
| `Pencil` | `RiPencilLine` |  |
| `Pin` | `RiPushpinLine` |  |
| `Play` | `RiPlayLine` |  |
| `Plug` | `RiPlugLine` |  |
| `Plus` | `RiAddLine` |  |
| `Printer` | `RiPrinterLine` |  |
| `QrCode` | `RiQrCodeLine` |  |
| `RefreshCw` | `RiRefreshLine` |  |
| `RotateCcw` | `RiRestartLine` | AudioTimeline history undo uses RiArrowGoBackLine; Agent retry/reopen can use Restart; restoring defaults can use ResetLeft. |
| `RotateCw` | `RiArrowGoForwardLine` |  |
| `Scissors` | `RiScissorsCutLine` |  |
| `Search` | `RiSearchLine` |  |
| `Settings` | `RiSettings3Line` |  |
| `Settings2` | `RiEqualizerLine` |  |
| `ShieldAlert` | `RiShieldFlashLine` |  |
| `ShieldCheck` | `RiShieldCheckLine` |  |
| `ShieldQuestion` | `RiShieldKeyholeLine` | No shield-question export exists. ShieldKeyhole represents guarded approval; preserve explanatory text. |
| `Shirt` | `RiTShirtLine` |  |
| `SkipBack` | `RiSkipBackLine` |  |
| `SkipForward` | `RiSkipForwardLine` |  |
| `SlidersHorizontal` | `RiEqualizerLine` |  |
| `Smile` | `RiEmotionHappyLine` |  |
| `Sparkles` | `RiSparklingLine` |  |
| `Square` | `RiStopLine` | Used to stop streaming and end microphone recording, so use Stop instead of an unrelated empty checkbox. |
| `SquareStack` | `RiStackLine` |  |
| `Trash2` | `RiDeleteBinLine` |  |
| `TriangleAlert` | `RiAlertLine` |  |
| `Type` | `RiText` | Text has no Line/Fill suffix. |
| `Undo2` | `RiArrowGoBackLine` |  |
| `Upload` | `RiUploadLine` |  |
| `UserRound` | `RiUserLine` |  |
| `Users` | `RiGroupLine` |  |
| `Video` | `RiVideoLine` |  |
| `Volume2` | `RiVolumeUpLine` |  |
| `VolumeX` | `RiVolumeMuteLine` |  |
| `Wrench` | `RiToolsLine` |  |
| `X` | `RiCloseLine` |  |
| `XIcon` | `RiCloseLine` |  |
| `ZoomIn` | `RiZoomInLine` |  |
| `ZoomOut` | `RiZoomOutLine` |  |

Recommended global navigation pairs (both exports verified):

| Destination | Idle | Selected |
| --- | --- | --- |
| `/agent` | `RiChat3Line` | `RiChat3Fill` |
| `/ips` | `RiUserLine` | `RiUserFill` |
| `/projects` | `RiFolderOpenLine` | `RiFolderOpenFill` |
| `/assets` | `RiBookShelfLine` | `RiBookShelfFill` |
| `/agent/tasks` | `RiTodoLine` | `RiTodoFill` |
| `/connectors` | `RiPlug2Line` | `RiPlug2Fill` |
| `/about` | `RiInformationLine` | `RiInformationFill` |

### External references and versions

- [Official Remix README](https://github.com/Remix-Design/RemixIcon/blob/master/README.md) documents the official `@remixicon/react` package, `Ri…Line`/`Ri…Fill` variants, `size`, `color` and className. Context7 `/remix-design/remixicon` confirmed this API on 2026-10-13.
- [Official npm publisher registry](https://registry.npmjs.org/@remixicon/react/latest) reports React package **4.9.0**, `sideEffects:false`, public root `index.mjs/index.js/index.d.ts`. The icon repository release number can differ from the React published package.
- [Published package types](https://unpkg.com/@remixicon/react@4.9.0/index.d.ts) and [runtime](https://unpkg.com/@remixicon/react@4.9.0/index.mjs) were checked; table symbols validated against actual installed declaration exports. The file banner still says v4.1.0, but package metadata is 4.9.0; do not use the stale banner as the version.
- Existing application baseline `lucide-react` declares ^0.544.0; brand package `@lobehub/icons` declares ^5.18.0 and its generated catalog remains publisher-pinned.

### Related specs

- `.trellis/spec/frontend/desktop-ui.md` — current navigation, titlebar, accessible buttons, scoped theme and testing contracts; update the active icon clause to official paired Remix glyphs after migration.
- `.trellis/spec/frontend/component-guidelines.md` — primitive ownership and base-ui ActionIcon keyboard contract.
- `.trellis/spec/guides/task-artifact-retention.md` — keep this authored conclusion, not copied package sources or raw logs.
- Task `design.md` currently says idle Lucide/local selected silhouettes and PRD says no new dependencies; the user steering explicitly supersedes those clauses. Main session should reconcile these artifacts.

## Caveats / Not Found

- Counts describe the source baseline; shared workers can be replacing imports while this report is being written. The final checker should scan src again for remaining Lucide/direct general-icon imports and verify provider/model matching was untouched.
- No exact Remix magnet or shield-question symbol exists in 4.9.0; intentional semantic substitutes are listed above. Right sidebar fold/unfold direction requires visual inspection.
- This research performs no UI/browser inspection and cannot establish visual size, loading-state consistency or runtime line/fill behavior. Test the adapter via an actual Lobe ActionIcon and inspect nav at both active/inactive states.
- Do not promise that the bundled application contains no Lucide: LobeHub itself depends on it and immutable source comparison fixtures intentionally retain it. The migration boundary is application-owned common UI icons.
