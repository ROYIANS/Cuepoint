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
| W147 | 907–909 | base | C | `.aw-root .aw-clip:hover .aw-trim-handle, .aw-root .aw-clip[data-selected=true] .aw-trim-handle, .aw-root .aw-trim-handle:focus-visible` | absent `aw-clip`; absent `aw-trim-handle` |
| W148 | 911–914 | base | C | `.aw-root .aw-trim-handle > span` | absent `aw-trim-handle` |
| W149 | 916–919 | base | C | `.aw-clip[data-selected=true]` | absent `aw-clip` |

At-rule containers (keep unless empty after verified branch edits): `@media (max-width: 1150px)` 577–599; `@media (max-width: 800px)` 601–682; `@media (max-width: 800px)` 819–840.

### src/components/audio/story-workspace.css

SHA-256: `2144425bbc19a08d3826ecb4c9243e6de6452ec8951feaaaf585041991dcc90a`.

| ID | Block lines | Context | Decision | Selector | Evidence |
| --- | --- | --- | --- | --- | --- |
| S001 | 1–8 | base | R | `.as-workspace` | `as-workspace` → src/components/audio/AudioWorkspacePage.tsx:141 |
| S002 | 10–19 | base | R | `.as-toolbar` | `as-toolbar` → src/components/audio/AudioWorkspacePage.tsx:142 |
| S003 | 21–26 | base | R | `.as-chapter-selector, .as-toolbar-actions, .as-view-modes` | `as-chapter-selector` → src/components/audio/AudioWorkspacePage.tsx:143; `as-toolbar-actions` → src/components/audio/AudioWorkspacePage.tsx:199; `as-view-modes` → src/components/audio/AudioWorkspacePage.tsx:193 |
| S004 | 28–30 | base | R | `.as-chapter-selector > button` | `as-chapter-selector` → src/components/audio/AudioWorkspacePage.tsx:143 |
| S005 | 32–35 | base | R | `.as-chapter-selector > button > span` | `as-chapter-selector` → src/components/audio/AudioWorkspacePage.tsx:143 |
| S006 | 37–45 | base | R | `.as-project-name` | `as-project-name` → src/components/audio/AudioWorkspacePage.tsx:192 |
| S007 | 47–49 | base | R | `.as-view-modes` | `as-view-modes` → src/components/audio/AudioWorkspacePage.tsx:193 |
| S008 | 51–56 | base | R | `.as-main` | `as-main` → src/components/audio/AudioWorkspacePage.tsx:217 |
| S009 | 58–63 | base | R | `.as-script-scroll` | `as-script-scroll` → src/components/audio/AudioWorkspacePage.tsx:218 |
| S010 | 65–69 | base | R | `.as-document` | `as-document` → src/components/audio/ScriptDocument.tsx:55 |
| S011 | 71–74 | base | C | `.as-document-heading` | absent `as-document-heading` |
| S012 | 76–82 | base | C | `.as-document-kicker` | absent `as-document-kicker` |
| S013 | 84–87 | base | C | `.as-document-kicker > span` | absent `as-document-kicker` |
| S014 | 89–94 | base | C | `.as-document-title` | absent `as-document-title` |
| S015 | 96–101 | base | C | `.as-document-title h1` | absent `as-document-title` |
| S016 | 103–105 | base | C | `.as-document-title > button` | absent `as-document-title` |
| S017 | 107–109 | base | C | `.as-document-title:hover > button, .as-document-title:focus-within > button` | absent `as-document-title` |
| S018 | 111–115 | base | C | `.as-document-heading > p` | absent `as-document-heading` |
| S019 | 117–121 | base | R | `.as-paragraphs` | `as-paragraphs` → src/components/audio/ScriptDocument.tsx:60 |
| S020 | 123–129 | base | R | `.as-paragraph` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167 |
| S021 | 131–137 | base | R | `.as-paragraph-gutter` | `as-paragraph-gutter` → src/components/audio/ScriptDocument.tsx:168 |
| S022 | 139–143 | base | R | `.as-paragraph-gutter > span` | `as-paragraph-gutter` → src/components/audio/ScriptDocument.tsx:168 |
| S023 | 145–157 | base | R | `.as-voice-avatar` | `as-voice-avatar` → src/components/audio/AudioInspector.tsx:65 |
| S024 | 159–163 | base | R | `.as-role-button` | `as-role-button` → src/components/audio/ScriptDocument.tsx:169 |
| S025 | 165–168 | base | R | `.as-paragraph-main` | `as-paragraph-main` → src/components/audio/ScriptDocument.tsx:209 |
| S026 | 170–173 | base | R | `.as-paragraph[data-selected=true] .as-paragraph-main` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167; `as-paragraph-main` → src/components/audio/ScriptDocument.tsx:209 |
| S027 | 175–180 | base | C | `.as-paragraph-meta` | absent `as-paragraph-meta` |
| S028 | 182–188 | base | C | `.as-role-name` | absent `as-role-name` |
| S029 | 190–194 | base | C | `.as-paragraph-status` | absent `as-paragraph-status` |
| S030 | 196–200 | base | C | `.as-paragraph-tools` | absent `as-paragraph-tools` |
| S031 | 202–204 | base | C | `.as-paragraph:hover .as-paragraph-tools, .as-paragraph:focus-within .as-paragraph-tools, .as-paragraph[data-selected=true] .as-paragraph-tools` | absent `as-paragraph-tools` |
| S032 | 206–220 | base | C | `.as-script-reading` | absent `as-script-reading` |
| S033 | 222–225 | base | C | `.as-script-reading:focus-visible` | absent `as-script-reading` |
| S034 | 227–234 | base | R | `.as-script-input` | `as-script-input` → src/components/audio/ScriptDocument.tsx:210 |
| S035 | 236–243 | base | C | `.as-paragraph-bottom` | absent `as-paragraph-bottom` |
| S036 | 245–250 | base | C | `.as-open-voice` | absent `as-open-voice` |
| S037 | 252–254 | base | C | `.as-paragraph:not([data-selected=true]):not(:hover):not(:focus-within) .as-paragraph-bottom` | absent `as-paragraph-bottom` |
| S038 | 256–262 | base | R | `.as-document-footer` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |
| S039 | 264–268 | base | R | `.as-document-footer > span` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |
| S040 | 270–272 | base | R | `.as-blank-document` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S041 | 274–277 | base | R | `.as-blank-document > p` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S042 | 279–284 | base | R | `.as-blank-document > span` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S043 | 286–291 | base | R | `.as-blank-document > div` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S044 | 293–297 | base | R | `.as-role-popover` | `as-role-popover` → src/components/audio/ScriptDocument.tsx:173 |
| S045 | 299–303 | base | R | `.as-role-popover > h3` | `as-role-popover` → src/components/audio/ScriptDocument.tsx:173 |
| S046 | 305–309 | base | R | `.as-role-options` | `as-role-options` → src/components/audio/ScriptDocument.tsx:175 |
| S047 | 311–315 | base | C | `.as-speaker-settings` | absent `as-speaker-settings` |
| S048 | 317–320 | base | R | `.as-chapter-menu` | `as-chapter-menu` → src/components/audio/AudioWorkspacePage.tsx:146 |
| S049 | 322–326 | base | R | `.as-menu-heading` | `as-menu-heading` → src/components/audio/AudioWorkspacePage.tsx:147 |
| S050 | 328–335 | base | R | `.as-inspector` | `as-inspector` → src/components/audio/AudioWorkspacePage.tsx:223 |
| S051 | 337–342 | base | R | `.as-inspector-top` | `as-inspector-top` → src/components/audio/AudioWorkspacePage.tsx:224 |
| S052 | 344–350 | base | R | `.as-inspector-top > span` | `as-inspector-top` → src/components/audio/AudioWorkspacePage.tsx:224 |
| S053 | 352–356 | base | R | `.as-inspector-content` | `as-inspector-content` → src/components/audio/AudioInspector.tsx:53 |
| S054 | 358–363 | base | R | `.as-inspector-tabs` | `as-inspector-tabs` → src/components/audio/AudioInspector.tsx:54 |
| S055 | 365–369 | base | R | `.as-inspector-tabs > button` | `as-inspector-tabs` → src/components/audio/AudioInspector.tsx:54 |
| S056 | 371–376 | base | R | `.as-inspector-heading` | `as-inspector-heading` → src/components/audio/AudioInspector.tsx:65 |
| S057 | 378–380 | base | R | `.as-inspector-heading > div` | `as-inspector-heading` → src/components/audio/AudioInspector.tsx:65 |
| S058 | 382–386 | base | R | `.as-inspector-heading strong` | `as-inspector-heading` → src/components/audio/AudioInspector.tsx:65 |
| S059 | 388–396 | base | R | `.as-inspector-heading small` | `as-inspector-heading` → src/components/audio/AudioInspector.tsx:65 |
| S060 | 398–404 | base | R | `.as-subheading` | `as-subheading` → src/components/audio/AudioInspector.tsx:75 |
| S061 | 406–408 | base | R | `.as-subheading > span` | `as-subheading` → src/components/audio/AudioInspector.tsx:75 |
| S062 | 410–415 | base | R | `.as-help` | `as-help` → src/components/audio/AudioInspector.tsx:77 |
| S063 | 417–421 | base | R | `.as-version-list` | `as-version-list` → src/components/audio/AudioInspector.tsx:78 |
| S064 | 423–430 | base | R | `.as-version-row` | `as-version-row` → src/components/audio/AudioInspector.tsx:79 |
| S065 | 432–435 | base | R | `.as-version-row > span` | `as-version-row` → src/components/audio/AudioInspector.tsx:79 |
| S066 | 437–444 | base | R | `.as-version-row strong` | `as-version-row` → src/components/audio/AudioInspector.tsx:79 |
| S067 | 446–452 | base | R | `.as-version-row small` | `as-version-row` → src/components/audio/AudioInspector.tsx:79 |
| S068 | 454–458 | base | R | `.as-take-detail` | `as-take-detail` → src/components/audio/AudioInspector.tsx:83 |
| S069 | 460–465 | base | R | `.as-detail-actions` | `as-detail-actions` → src/components/audio/AudioInspector.tsx:87 |
| S070 | 467–469 | base | R | `.as-generation` | `as-generation` → src/components/audio/SpeechControls.tsx:71 |
| S071 | 471–473 | base | R | `.as-note` | `as-note` → src/components/audio/AudioInspector.tsx:124 |
| S072 | 475–477 | base | R | `.as-inspector-empty` | `as-inspector-empty` → src/components/audio/AudioInspector.tsx:63 |
| S073 | 479–482 | base | R | `.as-inspector-empty > p` | `as-inspector-empty` → src/components/audio/AudioInspector.tsx:63 |
| S074 | 484–487 | base | R | `.as-inspector-empty > small` | `as-inspector-empty` → src/components/audio/AudioInspector.tsx:63 |
| S075 | 489–493 | base | R | `.as-inspector-sheet` | `as-inspector-sheet` → src/components/audio/AudioWorkspacePage.tsx:245 |
| S076 | 495–499 | base | R | `.as-sheet-scroll` | `as-sheet-scroll` → src/components/audio/AudioWorkspacePage.tsx:246 |
| S077 | 501–503 | base | R | `.as-sheet-scroll .as-inspector-content` | `as-sheet-scroll` → src/components/audio/AudioWorkspacePage.tsx:246; `as-inspector-content` → src/components/audio/AudioInspector.tsx:53 |
| S078 | 505–514 | base | R | `.as-error` | `as-error` → src/components/audio/AudioWorkspacePage.tsx:213 |
| S079 | 517–519 | @media (max-width: 1099px) | R | `.as-document` | `as-document` → src/components/audio/ScriptDocument.tsx:55 |
| S080 | 521–523 | @media (max-width: 1099px) | R | `.as-project-name` | `as-project-name` → src/components/audio/AudioWorkspacePage.tsx:192 |
| S081 | 527–532 | @media (max-width: 799px) | R | `.as-toolbar` | `as-toolbar` → src/components/audio/AudioWorkspacePage.tsx:142 |
| S082 | 534–536 | @media (max-width: 799px) | R | `.as-chapter-selector` | `as-chapter-selector` → src/components/audio/AudioWorkspacePage.tsx:143 |
| S083 | 538–540 | @media (max-width: 799px) | R | `.as-chapter-selector > button` | `as-chapter-selector` → src/components/audio/AudioWorkspacePage.tsx:143 |
| S084 | 542–548 | @media (max-width: 799px) | R | `.as-view-modes` | `as-view-modes` → src/components/audio/AudioWorkspacePage.tsx:193 |
| S085 | 550–552 | @media (max-width: 799px) | R | `.as-view-modes > button` | `as-view-modes` → src/components/audio/AudioWorkspacePage.tsx:193 |
| S086 | 554–556 | @media (max-width: 799px) | R | `.as-panel-button-label` | `as-panel-button-label` → src/components/audio/AudioWorkspacePage.tsx:211 |
| S087 | 558–560 | @media (max-width: 799px) | R | `.as-toolbar-actions` | `as-toolbar-actions` → src/components/audio/AudioWorkspacePage.tsx:199 |
| S088 | 562–564 | @media (max-width: 799px) | R | `.as-document` | `as-document` → src/components/audio/ScriptDocument.tsx:55 |
| S089 | 566–569 | @media (max-width: 799px) | C | `.as-document-heading` | absent `as-document-heading` |
| S090 | 571–573 | @media (max-width: 799px) | C | `.as-document-title h1` | absent `as-document-title` |
| S091 | 575–577 | @media (max-width: 799px) | C | `.as-document-title > button` | absent `as-document-title` |
| S092 | 579–581 | @media (max-width: 799px) | C | `.as-document-heading > p` | absent `as-document-heading` |
| S093 | 583–586 | @media (max-width: 799px) | R | `.as-paragraph` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167 |
| S094 | 588–590 | @media (max-width: 799px) | R | `.as-paragraph-main` | `as-paragraph-main` → src/components/audio/ScriptDocument.tsx:209 |
| S095 | 592–595 | @media (max-width: 799px) | M | `.as-script-reading, .as-script-input` | absent `as-script-reading`; `as-script-input` → src/components/audio/ScriptDocument.tsx:210 |
| S096 | 597–599 | @media (max-width: 799px) | C | `.as-paragraph-tools` | absent `as-paragraph-tools` |
| S097 | 601–603 | @media (max-width: 799px) | C | `.as-paragraph-status` | absent `as-paragraph-status` |
| S098 | 605–607 | @media (max-width: 799px) | C | `.as-paragraph[data-selected=true] .as-paragraph-bottom` | absent `as-paragraph-bottom` |
| S099 | 609–611 | @media (max-width: 799px) | C | `.as-paragraph-bottom [role=status]` | absent `as-paragraph-bottom` |
| S100 | 613–616 | @media (max-width: 799px) | R | `.as-document-footer` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |
| S101 | 618–620 | @media (max-width: 799px) | R | `.as-document-footer > span` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |
| S102 | 622–624 | @media (max-width: 799px) | R | `.as-blank-document` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S103 | 626–628 | @media (max-width: 799px) | R | `.as-blank-document > p` | `as-blank-document` → src/components/audio/ScriptDocument.tsx:56 |
| S104 | 630–632 | @media (max-width: 799px) | R | `.as-workspace[data-mode=timeline] > .as-main` | `as-workspace` → src/components/audio/AudioWorkspacePage.tsx:141; `as-main` → src/components/audio/AudioWorkspacePage.tsx:217 |
| S105 | 634–636 | @media (max-width: 799px) | R | `.as-inspector-sheet` | `as-inspector-sheet` → src/components/audio/AudioWorkspacePage.tsx:245 |
| S106 | 640–642 | @media (prefers-reduced-motion: reduce) | R | `.as-workspace *` | `as-workspace` → src/components/audio/AudioWorkspacePage.tsx:141 |
| S107 | 645–647 | base | R | `.as-inline-audition` | `as-inline-audition` → src/components/audio/ScriptDocument.tsx:252 |
| S108 | 649–651 | base | C | `.as-paragraph-bottom > .as-open-voice + .as-open-voice` | absent `as-paragraph-bottom`; absent `as-open-voice` |
| S109 | 653–655 | base | R | `.as-inspector-content .aw-select, .as-role-popover .aw-select` | `as-inspector-content` → src/components/audio/AudioInspector.tsx:53; `aw-select` → src/components/audioMusic/controls.tsx:29; `as-role-popover` → src/components/audio/ScriptDocument.tsx:173 |
| S110 | 657–659 | base | R | `.as-inspector-content .aw-field` | `as-inspector-content` → src/components/audio/AudioInspector.tsx:53; `aw-field` → src/components/audioMusic/shared.tsx:36 |
| S111 | 662–665 | base | R | `.as-document` | `as-document` → src/components/audio/ScriptDocument.tsx:55 |
| S112 | 667–669 | base | R | `.as-paragraphs` | `as-paragraphs` → src/components/audio/ScriptDocument.tsx:60 |
| S113 | 671–675 | base | R | `.as-paragraph` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167 |
| S114 | 677–681 | base | R | `.as-paragraph-gutter` | `as-paragraph-gutter` → src/components/audio/ScriptDocument.tsx:168 |
| S115 | 683–685 | base | R | `.as-paragraph:hover .as-paragraph-gutter, .as-paragraph:focus-within .as-paragraph-gutter, .as-paragraph[data-selected=true] .as-paragraph-gutter` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167; `as-paragraph-gutter` → src/components/audio/ScriptDocument.tsx:168 |
| S116 | 687–690 | base | R | `.as-role-button` | `as-role-button` → src/components/audio/ScriptDocument.tsx:169 |
| S117 | 692–696 | base | R | `.as-role-button .as-voice-avatar` | `as-role-button` → src/components/audio/ScriptDocument.tsx:169; `as-voice-avatar` → src/components/audio/AudioInspector.tsx:65 |
| S118 | 698–700 | base | R | `.as-paragraph-main` | `as-paragraph-main` → src/components/audio/ScriptDocument.tsx:209 |
| S119 | 702–705 | base | R | `.as-paragraph[data-selected=true] .as-paragraph-main` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167; `as-paragraph-main` → src/components/audio/ScriptDocument.tsx:209 |
| S120 | 707–719 | base | R | `.as-script-input` | `as-script-input` → src/components/audio/ScriptDocument.tsx:210 |
| S121 | 721–725 | base | R | `.as-script-input:focus-visible` | `as-script-input` → src/components/audio/ScriptDocument.tsx:210 |
| S122 | 727–734 | base | R | `.as-line-menu-actions` | `as-line-menu-actions` → src/components/audio/ScriptDocument.tsx:192 |
| S123 | 736–738 | base | R | `.as-document-footer` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |
| S124 | 741–743 | @media (max-width: 799px) | R | `.as-document` | `as-document` → src/components/audio/ScriptDocument.tsx:55 |
| S125 | 745–748 | @media (max-width: 799px) | R | `.as-paragraph` | `as-paragraph` → src/components/audio/ScriptDocument.tsx:167 |
| S126 | 750–753 | @media (max-width: 799px) | R | `.as-script-input` | `as-script-input` → src/components/audio/ScriptDocument.tsx:210 |
| S127 | 755–757 | @media (max-width: 799px) | R | `.as-document-footer` | `as-document-footer` → src/components/audio/ScriptDocument.tsx:75 |

At-rule containers (keep unless empty after verified branch edits): `@media (max-width: 1099px)` 516–524; `@media (max-width: 799px)` 526–637; `@media (prefers-reduced-motion: reduce)` 639–643; `@media (max-width: 799px)` 740–758.

## Writer handoff

Recheck the two CSS hashes and cited producer/input hashes before applying edits; concurrent E01/E02 work may change snapshots. Remove only C blocks or missing-class branches in M blocks after the writer establishes native desktop/narrow baseline. Preserve current responsive player/select/inspector/sheet/portal styles, declaration order, used shared branches, reduced-motion and theme variables. Check audio script with selected/unselected paragraphs, role/chapter popovers, inspector aside/sheet, voices/preview, imported/recorded/library source paths, audio timeline/trim/SVG waveform/export, music composer/library/details-sheet/player, and persisted generation states. Capture the same representative states before/after, including widths around the actual 1099/799 audio, 1280 music details, 1000/760 music layout, and 800 shared boundaries.

No source/CSS/tests/application or regression scripts/specs/status/ledger edits, installs, commits, browser runs or full lint were performed. Reproducer: `node .trellis/tasks/10-09-src-remediation-e/research/e03-inventory/produce.cjs`. It only reads sources and rewrites the two inventory artifacts; it aborts if scanned source bytes change during generation.
