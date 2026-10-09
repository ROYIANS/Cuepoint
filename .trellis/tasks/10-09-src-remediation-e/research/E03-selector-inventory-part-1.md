# E03 original selector inventory, part1/2

Exact original lines 1–191; source `.trellis/tasks/10-09-src-remediation-e/research/E03-selector-inventory.md`, SHA-256 `bebde62494239267c29828aac4c57b3cc382862a7d471216065cb4501f8534fa`. Other parts are required; original inventory/JSON/producer unchanged.

# E03 PU09 selector inventory — preparation only

This is a bounded, read-only snapshot of the two requested stylesheets and their current rendering/import closure. It does not start or close E03 and does not change E01/E02 ownership. No native visual proof has been performed. Candidate status is evidence for the later E03 writer, not deletion authorization without the required desktop/narrow before/after comparison.

Snapshot: 2026-10-09T02:49:38.065Z; HEAD `1ecaf5ceec92e022c2b2b8d662e2a92e8eee36c7`. SHA-256 values describe actual working-tree bytes, including current uncommitted E01 changes. Input manifest digest: `26ae8d383d27b761485e0edf3146691846f7066a2b0a9f65747306a50db245f5`. The JSON includes every scanned src path/hash, task contract hashes, exact block offsets/hash, every selector branch and positive class producer locations. Input stability was checked during generation.

## Counts and interpretation

| Stylesheet | Blocks | Branches | Whole block candidates | Mixed blocks | Candidate branches | Fully retained blocks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| src/components/audioMusic/workspace.css | 149 | 160 | 87 | 1 | 96 | 61 |
| src/components/audio/story-workspace.css | 127 | 136 | 28 | 1 | 32 | 98 |

Counts measure selector coverage, not correctness or visual proof. `C` = verified unreferenced class in this snapshot; whole rule block is a candidate. `M` = mixed selector list; edit only unused branches and preserve declarations/used branches. `R` = retain because every class has a current JSX producer; descendant/state matching is conservative and remains subject to native proof.

## Current consumers and safeguards

src/routes/p.$projectId.index.tsx:2,8 imports/renders ProjectHomePage; ProjectHomePage.tsx:49-50 dispatches audio/music project kinds. AudioWorkspacePage.tsx:31,38 imports shared helpers (shared.tsx:22 imports workspace.css) and story-workspace.css; its current script/inspector layout uses as-* classes. MusicWorkspacePage.tsx:18-27,35,133 imports shared helpers/music-workspace.css and renders aw-root mw-root; its actual composer/library/details classes are mw-*. AudioTimeline.tsx:54,515-618 uses timeline.css and at-* tracks/clips/trim handles; its waveform is an SVG at AudioTimeline.tsx:659, not an aw-waveform canvas. Do not remove live shared controls on the strength of these redesigns. All exact import edges are in JSON.

Shared Field/Empty/SavedText/AudioPlayer/GenerationJobs provide aw-* producers. controls.tsx:29,63,124-164,180-188 forwards Select/Slider/Disclosure classes and renders the custom player. AudioSources.tsx:186-218 retains recorder, meter (child div), layout and SourcePlayer; AudioSources.tsx:232-256 and AudioExports.tsx:17-39 retain source lists/history/errors. VoiceLibrary/VoiceReferencePicker still use compact AudioPlayer and shared selects through portals; preserve E01 voice editor state and pending contracts.

PopoverContent uses ui/popover.tsx:25-36 Radix Portal; SelectContent uses ui/select.tsx:53-78 Portal, while SelectValue data-slot is on its trigger. SheetContent uses ui/sheet.tsx:70-88 Portal; DialogContent also portals. Therefore popup selectors are globally reachable even outside aw-root/as-workspace. Keep the unscoped aw-disclosure-title branch and as-role-popover/as-chapter-menu/as-inspector-sheet rules. Generic UI wrappers compose caller className with cn; verify rendered descendants natively rather than requiring every DOM tag to appear locally.

Responsive consumers: audio useInspectorSheet matches max-width:1099px (AudioWorkspacePage.tsx:41-44), renders desktop aside at :223 and portaled sheet at :244-247; script/timeline mode is data-mode at :141. story-workspace.css has 1099px and 799px rules plus prefers-reduced-motion. workspace.css has 1150px and two 800px groups; current aw-player/custom-player/title/volume/playback-slider rules must survive. Music uses min-width:1280px matchMedia (MusicWorkspacePage.tsx:58,75) for details aside/sheet (:204-215), and music-workspace.css uses max-width:1000px/:299 and 760px/:317 for layout/volume/mobile rules. timeline.css also adapts at 1000px and 799px. Current mw-body data-mode is MusicWorkspacePage.tsx:138. Narrow-only visibility is not absence.

Dynamic caveat: no current producer concatenates an aw-* or as-* name from a prefix/suffix. controls.tsx interpolates caller className after fixed aw-select/aw-slider/aw-disclosure-title; Disclosure passes className directly. AudioPlayer chooses aw-audition/aw-player conditionally. Current local call sites in the audio/audioMusic/music closure were inspected; componentUsage in JSON records their literal/omitted className and spread status. Nonliteral className expressions and their individual resolution/unsupported status are recorded in computedClassReview. at-trim-${side} at AudioTimeline.tsx:618 is live and belongs to timeline.css. Generic forwarded className, arbitrary cn calls, spreads and DOM controlled by libraries are unsupported by the evaluator, so the JSON lists all current nonliteral className expressions; it does not pretend to evaluate arbitrary JavaScript. No candidate has a raw non-CSS src mention.

Platform/media: recorder.ts:29-36,118 uses navigator.mediaDevices and Web Audio createAnalyser; timeline uses native pointer/key/scroll operations and modifier keys. These do not synthesize old aw-* / as-* classes. Playback contains a hidden native audio element; waveform is SVG. Native audio/permission/platform interactions and portal inherited variables remain visual/behavior verification work for the E03 writer, not proof furnished by this inventory.

Two structural observations are kept for native proof and excluded from candidate counts. `.as-paragraph-gutter > span` at story-workspace.css:139-143 currently has a Button below its PopoverTrigger, with the voice-avatar span inside that Button (ScriptDocument.tsx:168-174); inspect actual Radix DOM before deciding whether the old direct-child numbering rule is unused. The other observation: story-workspace.css:653-655 contains `.as-role-popover .aw-select`, but the current ScriptDocument role popover (:173-207) contains buttons/actions, no WorkspaceSelect. Both classes are live independently. Keep this branch during preparation; if later proven unused in native DOM, remove only that branch because `.as-inspector-content .aw-select` is current. Do not infer unused descendants/state variants from independent class tokens alone.

## Absent classes (current snapshot)

`as-document-heading`, `as-document-kicker`, `as-document-title`, `as-open-voice`, `as-paragraph-bottom`, `as-paragraph-meta`, `as-paragraph-status`, `as-paragraph-tools`, `as-role-name`, `as-script-reading`, `as-speaker-settings`, `aw-body`, `aw-check`, `aw-clip`, `aw-clip-select`, `aw-content`, `aw-detail-title`, `aw-eyebrow`, `aw-header`, `aw-inspector`, `aw-mobile-tabs`, `aw-music-body`, `aw-music-row`, `aw-music-row-title`, `aw-nav-item`, `aw-number`, `aw-numbers`, `aw-playhead`, `aw-rail`, `aw-ruler`, `aw-section-heading`, `aw-segment`, `aw-segment-head`, `aw-take`, `aw-takes`, `aw-timeline`, `aw-track-label`, `aw-track-lane`, `aw-track-row`, `aw-track-volume-slider`, `aw-transport`, `aw-trim-end`, `aw-trim-handle`, `aw-trim-start`, `aw-waveform`, `aw-work-number`, `aw-zoom-slider`.

## Every selector block

Line ranges include the closing brace. JSON stores zero-based UTF-16 start/end-exclusive offsets and original block hashes. References below identify the current JSX class producer for every class in a retained branch; expanded locations are in JSON. R rows preserve pseudo/state/tag/attribute selectors conservatively.

### src/components/audioMusic/workspace.css

SHA-256: `ea0d1dddecc60a1f47f494c4e0e46b04a536fde3666beb02c4b2a79ddac7878c`.

| ID | Block lines | Context | Decision | Selector | Evidence |
| --- | --- | --- | --- | --- | --- |
| W001 | 1–11 | base | R | `.aw-root` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133 |
| W002 | 13–21 | base | C | `.aw-header` | absent `aw-header` |
| W003 | 23–27 | base | C | `.aw-header h1` | absent `aw-header` |
| W004 | 29–34 | base | C | `.aw-eyebrow` | absent `aw-eyebrow` |
| W005 | 36–39 | base | M | `.aw-header small, .aw-muted` | absent `aw-header`; `aw-muted` → src/components/audio/AudioExports.tsx:26 |
| W006 | 41–46 | base | R | `.aw-actions` | `aw-actions` → src/components/audio/AudioExports.tsx:27 |
| W007 | 48–54 | base | C | `.aw-body` | absent `aw-body` |
| W008 | 56–60 | base | C | `.aw-rail, .aw-inspector, .aw-content` | absent `aw-rail`; absent `aw-inspector`; absent `aw-content` |
| W009 | 62–64 | base | C | `.aw-rail` | absent `aw-rail` |
| W010 | 66–68 | base | C | `.aw-inspector` | absent `aw-inspector` |
| W011 | 70–72 | base | C | `.aw-content` | absent `aw-content` |
| W012 | 74–81 | base | C | `.aw-section-heading` | absent `aw-section-heading` |
| W013 | 83–85 | base | C | `.aw-section-heading:not(:first-child)` | absent `aw-section-heading` |
| W014 | 87–98 | base | C | `.aw-nav-item` | absent `aw-nav-item` |
| W015 | 100–104 | base | C | `.aw-nav-item span` | absent `aw-nav-item` |
| W016 | 106–108 | base | C | `.aw-nav-item:hover, .aw-nav-item[aria-selected=true]` | absent `aw-nav-item` |
| W017 | 110–113 | base | C | `.aw-nav-item[aria-selected=true]` | absent `aw-nav-item` |
| W018 | 115–121 | base | R | `.aw-field` | `aw-field` → src/components/audioMusic/shared.tsx:36 |
| W019 | 123–125 | base | R | `.aw-field > span` | `aw-field` → src/components/audioMusic/shared.tsx:36 |
| W020 | 127–131 | base | R | `.aw-field small` | `aw-field` → src/components/audioMusic/shared.tsx:36 |
| W021 | 133–145 | base | R | `.aw-empty` | `aw-empty` → src/components/audioMusic/shared.tsx:43 |
| W022 | 147–151 | base | R | `.aw-empty h3` | `aw-empty` → src/components/audioMusic/shared.tsx:43 |
| W023 | 153–156 | base | R | `.aw-empty p` | `aw-empty` → src/components/audioMusic/shared.tsx:43 |
| W024 | 158–164 | base | R | `.aw-error` | `aw-error` → src/components/audio/AudioExports.tsx:39 |
| W025 | 166–170 | base | R | `.aw-banner` | `aw-banner` → src/components/music/MusicWorkspacePage.tsx:137 |
| W026 | 172–175 | base | C | `.aw-segment` | absent `aw-segment` |
| W027 | 177–182 | base | C | `.aw-segment-head` | absent `aw-segment-head` |
| W028 | 184–187 | base | C | `.aw-segment-head .aw-number` | absent `aw-segment-head`; absent `aw-number` |
| W029 | 189–192 | base | C | `.aw-segment[data-selected=true] .aw-number` | absent `aw-segment`; absent `aw-number` |
| W030 | 194–196 | base | C | `.aw-segment[data-selected=true] .aw-segment-head` | absent `aw-segment`; absent `aw-segment-head` |
| W031 | 198–203 | base | R | `.aw-saved-field` | `aw-saved-field` → src/components/audioMusic/shared.tsx:68 |
| W032 | 205–209 | base | R | `.aw-saved-field textarea` | `aw-saved-field` → src/components/audioMusic/shared.tsx:68 |
| W033 | 211–213 | base | R | `.aw-saved-field > [role=status]` | `aw-saved-field` → src/components/audioMusic/shared.tsx:68 |
| W034 | 215–220 | base | C | `.aw-takes` | absent `aw-takes` |
| W035 | 222–233 | base | C | `.aw-take` | absent `aw-take` |
| W036 | 235–238 | base | C | `.aw-take[aria-pressed=true]` | absent `aw-take` |
| W037 | 240–244 | base | C | `.aw-take small` | absent `aw-take` |
| W038 | 246–255 | base | R | `.aw-player` | `aw-player` → src/components/audioMusic/shared.tsx:97 |
| W039 | 257–263 | base | R | `.aw-player-title` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W040 | 265–271 | base | R | `.aw-player-title strong` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W041 | 273–278 | base | R | `.aw-player-title small` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W042 | 280–285 | base | R | `.aw-jobs` | `aw-jobs` → src/components/audioMusic/shared.tsx:174 |
| W043 | 287–289 | base | R | `.aw-jobs .aw-disclosure-title` | `aw-jobs` → src/components/audioMusic/shared.tsx:174; `aw-disclosure-title` → src/components/audioMusic/controls.tsx:187 |
| W044 | 291–294 | base | R | `.aw-jobs .aw-disclosure-title span` | `aw-jobs` → src/components/audioMusic/shared.tsx:174; `aw-disclosure-title` → src/components/audioMusic/controls.tsx:187 |
| W045 | 296–302 | base | R | `.aw-job` | `aw-job` → src/components/audioMusic/shared.tsx:155 |
| W046 | 304–307 | base | R | `.aw-job strong, .aw-job small` | `aw-job` → src/components/audioMusic/shared.tsx:155 |
| W047 | 309–312 | base | R | `.aw-job small` | `aw-job` → src/components/audioMusic/shared.tsx:155 |
| W048 | 314–321 | base | C | `.aw-timeline` | absent `aw-timeline` |
| W049 | 323–332 | base | C | `.aw-transport` | absent `aw-transport` |
| W050 | 334–337 | base | R | `.aw-time` | `aw-time` → src/components/audio/AudioSources.tsx:191 |
| W051 | 339–343 | base | C | `.aw-track-row` | absent `aw-track-row` |
| W052 | 345–355 | base | C | `.aw-track-label` | absent `aw-track-label` |
| W053 | 357–360 | base | C | `.aw-track-label strong` | absent `aw-track-label` |
| W054 | 362–367 | base | C | `.aw-track-lane` | absent `aw-track-lane` |
| W055 | 369–381 | base | C | `.aw-clip` | absent `aw-clip` |
| W056 | 383–386 | base | C | `.aw-clip[data-role=music]` | absent `aw-clip` |
| W057 | 388–391 | base | C | `.aw-clip[data-role=effects]` | absent `aw-clip` |
| W058 | 393–396 | base | C | `.aw-clip[data-selected=true]` | absent `aw-clip` |
| W059 | 398–407 | base | C | `.aw-clip span` | absent `aw-clip` |
| W060 | 409–414 | base | C | `.aw-waveform` | absent `aw-waveform` |
| W061 | 416–422 | base | C | `.aw-ruler` | absent `aw-ruler` |
| W062 | 424–427 | base | C | `.aw-ruler span` | absent `aw-ruler` |
| W063 | 429–437 | base | C | `.aw-playhead` | absent `aw-playhead` |
| W064 | 439–443 | base | C | `.aw-numbers` | absent `aw-numbers` |
| W065 | 445–448 | base | R | `.aw-recorder` | `aw-recorder` → src/components/audio/AudioSources.tsx:186 |
| W066 | 450–457 | base | R | `.aw-meter` | `aw-meter` → src/components/audio/AudioSources.tsx:194 |
| W067 | 459–463 | base | R | `.aw-meter div` | `aw-meter` → src/components/audio/AudioSources.tsx:194 |
| W068 | 465–467 | base | C | `.aw-music-body` | absent `aw-music-body` |
| W069 | 469–477 | base | C | `.aw-music-row` | absent `aw-music-row` |
| W070 | 479–481 | base | C | `.aw-music-row[data-selected=true]` | absent `aw-music-row` |
| W071 | 483–486 | base | C | `.aw-music-row-title` | absent `aw-music-row-title` |
| W072 | 488–495 | base | C | `.aw-music-row-title strong` | absent `aw-music-row-title` |
| W073 | 497–502 | base | C | `.aw-music-row-title small` | absent `aw-music-row-title` |
| W074 | 504–507 | base | C | `.aw-work-number` | absent `aw-work-number` |
| W075 | 509–515 | base | C | `.aw-check` | absent `aw-check` |
| W076 | 517–519 | base | C | `.aw-mobile-tabs` | absent `aw-mobile-tabs` |
| W077 | 521–526 | base | R | `.aw-lyrics` | `aw-lyrics` → src/components/music/MusicWorkspacePage.tsx:251 |
| W078 | 528–533 | base | C | `.aw-detail-title` | absent `aw-detail-title` |
| W079 | 535–539 | base | R | `.aw-inline` | `aw-inline` → src/components/audio/AudioSources.tsx:191 |
| W080 | 541–543 | base | R | `.aw-inline > *` | `aw-inline` → src/components/audio/AudioSources.tsx:191 |
| W081 | 545–547 | base | R | `.aw-grow` | `aw-grow` → src/components/audio/AudioSources.tsx:191 |
| W082 | 549–553 | base | R | `.aw-root .aw-disclosure-title` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133; `aw-disclosure-title` → src/components/audioMusic/controls.tsx:187 |
| W083 | 555–559 | base | R | `.aw-source-list` | `aw-source-list` → src/components/audio/AudioExports.tsx:20 |
| W084 | 561–565 | base | R | `.aw-source` | `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W085 | 567–571 | base | R | `.aw-source strong` | `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W086 | 573–575 | base | R | `.aw-source small` | `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W087 | 578–580 | @media (max-width: 1150px) | C | `.aw-body` | absent `aw-body` |
| W088 | 582–584 | @media (max-width: 1150px) | C | `.aw-music-body` | absent `aw-music-body` |
| W089 | 586–590 | @media (max-width: 1150px) | C | `.aw-music-body > .aw-inspector` | absent `aw-music-body`; absent `aw-inspector` |
| W090 | 592–594 | @media (max-width: 1150px) | C | `.aw-content` | absent `aw-content` |
| W091 | 596–598 | @media (max-width: 1150px) | R | `.aw-player-title` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W092 | 602–606 | @media (max-width: 800px) | R | `.aw-root` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133 |
| W093 | 608–610 | @media (max-width: 800px) | C | `.aw-header` | absent `aw-header` |
| W094 | 612–617 | @media (max-width: 800px) | C | `.aw-body` | absent `aw-body` |
| W095 | 619–623 | @media (max-width: 800px) | C | `.aw-rail, .aw-inspector, .aw-content` | absent `aw-rail`; absent `aw-inspector`; absent `aw-content` |
| W096 | 625–627 | @media (max-width: 800px) | C | `.aw-rail` | absent `aw-rail` |
| W097 | 629–631 | @media (max-width: 800px) | C | `.aw-inspector` | absent `aw-inspector` |
| W098 | 633–638 | @media (max-width: 800px) | C | `.aw-mobile-tabs` | absent `aw-mobile-tabs` |
| W099 | 640–642 | @media (max-width: 800px) | C | `.aw-body[data-tab=content] > .aw-inspector, .aw-body[data-tab=properties] > .aw-content` | absent `aw-body`; absent `aw-inspector`; absent `aw-content` |
| W100 | 644–646 | @media (max-width: 800px) | C | `.aw-body[data-tab=properties] > .aw-rail` | absent `aw-body`; absent `aw-rail` |
| W101 | 648–655 | @media (max-width: 800px) | R | `.aw-player` | `aw-player` → src/components/audioMusic/shared.tsx:97 |
| W102 | 657–660 | @media (max-width: 800px) | R | `.aw-player-title` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W103 | 662–665 | @media (max-width: 800px) | C | `.aw-timeline` | absent `aw-timeline` |
| W104 | 667–669 | @media (max-width: 800px) | C | `.aw-music-body > .aw-inspector` | absent `aw-music-body`; absent `aw-inspector` |
| W105 | 671–673 | @media (max-width: 800px) | C | `.aw-track-label` | absent `aw-track-label` |
| W106 | 675–677 | @media (max-width: 800px) | C | `.aw-ruler` | absent `aw-ruler` |
| W107 | 679–681 | @media (max-width: 800px) | C | `.aw-header h1` | absent `aw-header` |
| W108 | 685–690 | base | R | `.aw-root .aw-select` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133; `aw-select` → src/components/audioMusic/controls.tsx:29 |
| W109 | 692–695 | base | R | `.aw-select [data-slot=select-value]` | `aw-select` → src/components/audioMusic/controls.tsx:29 |
| W110 | 697–700 | base | C | `.aw-segment-head .aw-select` | absent `aw-segment-head` |
| W111 | 702–705 | base | C | `.aw-root .aw-nav-item` | absent `aw-nav-item` |
| W112 | 707–712 | base | C | `.aw-root .aw-take` | absent `aw-take` |
| W113 | 714–721 | base | C | `.aw-root .aw-music-row-title` | absent `aw-music-row-title` |
| W114 | 723–729 | base | C | `.aw-root .aw-clip` | absent `aw-clip` |
| W115 | 731–733 | base | C | `.aw-root .aw-clip:hover` | absent `aw-clip` |
| W116 | 735–739 | base | C | `.aw-root .aw-takes` | absent `aw-takes` |
| W117 | 741–743 | base | R | `.aw-root .aw-player` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133; `aw-player` → src/components/audioMusic/shared.tsx:97 |
| W118 | 745–752 | base | R | `.aw-custom-player` | `aw-custom-player` → src/components/audioMusic/controls.tsx:124 |
| W119 | 754–756 | base | R | `.aw-custom-player > audio` | `aw-custom-player` → src/components/audioMusic/controls.tsx:124 |
| W120 | 758–760 | base | R | `.aw-custom-player .aw-time` | `aw-custom-player` → src/components/audioMusic/controls.tsx:124; `aw-time` → src/components/audio/AudioSources.tsx:191 |
| W121 | 762–765 | base | R | `.aw-playback-slider` | `aw-playback-slider` → src/components/audioMusic/controls.tsx:149 |
| W122 | 767–769 | base | R | `.aw-volume-slider` | `aw-volume-slider` → src/components/audioMusic/controls.tsx:160 |
| W123 | 771–773 | base | C | `.aw-zoom-slider` | absent `aw-zoom-slider` |
| W124 | 775–777 | base | C | `.aw-track-volume-slider` | absent `aw-track-volume-slider` |
| W125 | 779–783 | base | R | `.aw-slider` | `aw-slider` → src/components/audioMusic/controls.tsx:63 |
| W126 | 785–787 | base | R | `.aw-audition` | `aw-audition` → src/components/audioMusic/shared.tsx:97 |
| W127 | 789–791 | base | R | `.aw-recorder .aw-custom-player` | `aw-recorder` → src/components/audio/AudioSources.tsx:186; `aw-custom-player` → src/components/audioMusic/controls.tsx:124 |
| W128 | 793–795 | base | C | `.aw-transport .aw-field` | absent `aw-transport` |
| W129 | 797–799 | base | C | `.aw-source-list .aw-take` | absent `aw-take` |
| W130 | 801–803 | base | C | `.aw-root .aw-music-row` | absent `aw-music-row` |
| W131 | 805–811 | base | C | `.aw-take[aria-pressed=true]::after` | absent `aw-take` |
| W132 | 813–817 | base | C | `.aw-nav-item[aria-selected=true]::after` | absent `aw-nav-item` |
| W133 | 820–822 | @media (max-width: 800px) | R | `.aw-custom-player` | `aw-custom-player` → src/components/audioMusic/controls.tsx:124 |
| W134 | 824–826 | @media (max-width: 800px) | R | `.aw-volume-slider` | `aw-volume-slider` → src/components/audioMusic/controls.tsx:160 |
| W135 | 828–831 | @media (max-width: 800px) | R | `.aw-player-title` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W136 | 833–835 | @media (max-width: 800px) | R | `.aw-player-title small` | `aw-player-title` → src/components/audioMusic/shared.tsx:98 |
| W137 | 837–839 | @media (max-width: 800px) | R | `.aw-playback-slider` | `aw-playback-slider` → src/components/audioMusic/controls.tsx:149 |
| W138 | 842–855 | base | R | `.aw-root .aw-disclosure-title, .aw-disclosure-title` | `aw-root` → src/components/music/MusicWorkspacePage.tsx:133; `aw-disclosure-title` → src/components/audioMusic/controls.tsx:187 |
| W139 | 857–859 | base | R | `.aw-disclosure-title svg` | `aw-disclosure-title` → src/components/audioMusic/controls.tsx:187 |
| W140 | 861–863 | base | R | `.aw-export-history .aw-source` | `aw-export-history` → src/components/audio/AudioExports.tsx:17; `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W141 | 865–867 | base | R | `.aw-export-history .aw-source strong` | `aw-export-history` → src/components/audio/AudioExports.tsx:17; `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W142 | 869–871 | base | R | `.aw-export-history .aw-source small` | `aw-export-history` → src/components/audio/AudioExports.tsx:17; `aw-source` → src/components/audio/AudioExports.tsx:24 |
| W143 | 873–881 | base | C | `.aw-root .aw-clip-select` | absent `aw-clip-select` |
| W144 | 883–897 | base | C | `.aw-root .aw-trim-handle` | absent `aw-trim-handle` |
| W145 | 899–901 | base | C | `.aw-root .aw-trim-start` | absent `aw-trim-start` |
| W146 | 903–905 | base | C | `.aw-root .aw-trim-end` | absent `aw-trim-end` |
