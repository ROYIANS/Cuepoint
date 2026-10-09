# E03 original selector inventory, part2/2

Exact original lines 192–338; source `.trellis/tasks/10-09-src-remediation-e/research/E03-selector-inventory.md`, SHA-256 `bebde62494239267c29828aac4c57b3cc382862a7d471216065cb4501f8534fa`. Other parts are required; original inventory/JSON/producer unchanged.

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
