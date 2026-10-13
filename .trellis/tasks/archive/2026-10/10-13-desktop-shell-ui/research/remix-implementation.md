# Common UI Remix implementation — 2026-10-13

## Scope and result

This worker migrated 78 application-owned Lucide consumer files, added
`src/components/ui/remixIcons.tsx`, and removed the icon-only stroke-weight rule
from `src/components/studio/materials/materialLibrary.css`. AppFrame and its
selected-navigation implementation were a separate worker's responsibility.
Package/lockfile, shared specs and quality evidence remain main/reviewer-owned.

The shared module uses 116 explicit semantic exports backed by 103 official
named glyph imports from pinned `@remixicon/react` 4.9.0. Each wrapper factory
call is annotated pure so unused glyphs can be removed. No dynamic icon registry
or import of the entire icon namespace was introduced.

The adapter preserves `size`, `color`, classes, accessibility props and React 19
SVG ref forwarding. It removes LobeUI's transparent `fill`, redundant dimensions
and Lucide stroke geometry props before rendering the official Remix component.
Both Remix Line and Fill symbols own filled path geometry; no stroke or global
fill CSS is applied to them. The narrow TopicSidebar icon contract no longer
accepts custom stroke weight.

## Semantic exceptions

- Music favorites now choose `Heart`/`HeartFill` explicitly, preserving both the
  filter and per-work favorite state and their original callbacks.
- Timeline undo/redo use official ArrowGoBack/ArrowGoForward glyphs through
  `Undo2`/`Redo2`; the history commands and disabled guards are unchanged.
- Remix has no magnet symbol. The existing labeled/pressed timeline snap action
  uses Focus2 through the semantic `Snap` export.
- Context defaults, restored memories and AI-suggestion restoration use ResetLeft
  through `Restore`; retry/reopen actions retain Restart through `RotateCcw`.
- Right inspector fold/unfold glyphs mirror the official left-sidebar shapes to
  retain the panel/arrow direction. Main-session visual inspection owns acceptance.
- ShieldQuestion has no exact official counterpart; ShieldKeyhole conveys the
  guarded approval action while existing explanatory labels remain.
- Custom waveform and context-usage meter SVG remain data visualizations with
  their actual stroke geometry. Model/provider branding and immutable comparison
  snapshot bytes remain unchanged.

## Verification

- Approved machine pnpm `lint`: passed after final source edits.
- Focused Vitest: **4 files / 70 tests passed** — `remixIcons`,
  `sharedVideoPageParity`, `b01QueryIdentity`, `b07ComposeSessions`.
- The two new rendering tests exercise the real LobeUI base-ui ActionIcon under
  its actual MotionProvider and verify visible fill, native button/accessibility,
  explicit color/semantic size and suppression of injected stroke geometry.
- Test setup corrections were required before the final passing run: bare
  ActionIcon SSR lacked MotionProvider; importing the complete LobeUI barrel
  pulled a JSON dependency unsupported by Node 24's direct module loader. The
  final test uses the package's published `es/MotionProvider/index` subpath and
  the actual motion component; no dependency implementation is mocked.
- An isolated esbuild tree-shaking probe with React externalized kept **one SVG
  path / 1,027 bytes** for one `Search` adapter import, compared with **665 bytes**
  for the direct official glyph. Exporting all semantic adapters would retain
  **103 paths / 66,011 bytes**. This verifies the single-import behavior; it is
  not a claim about the complete product's initial chunk size.
- Final source scan: no application `src` import from Lucide; direct Remix value
  imports are confined to the shared module and AppFrame's official paired nav.
- `git diff` for immutable source snapshots and the three model/provider brand
  owner files is empty.

## Remaining acceptance

Main session/reviewer own production build/full quality gates and real browser
and macOS UI inspection, including right-panel direction, favorite variants and
LobeUI menus/composer controls. LobeHub's dependency-owned internal icons still
use its own icon package; no node_modules patch is part of this migration.

No commit or remote action was performed by this worker.

## Native expanded-editor follow-up

Main-session macOS inspection at the actual 760x520 minimum window found a
stable expanded-editor failure: the placeholder was clipped to a narrow strip
and the ordinary composer controls stayed near the top of the editing surface.
A second settled native screenshot reproduced it; it was not treated as a
transition artifact.

The expanded dock/content/stack/composer height chain remains complete. Installed
AntD 6.6.4 and @rc-component/input 1.3.1 render the unadorned TextArea directly;
their ResizeObserver clones its child and adds no layout wrapper. The expanded
rule in `composerControls.css` imposed `height:0!important` on this native form
element. This matched the observed collapsed input strip despite its flex growth
declaration. The main session explicitly extended this worker's file ownership
to that actual CSS owner.

The bounded correction changes only this expanded textarea rule to
`flex:1 1 auto` and `height:100%!important`. `min-height:0`, automatic vertical
scrolling, nonshrinking footer/control rows and the existing 100% parent heights
remain. Leaving expanded mode removes this selector and resumes the existing
normal textarea sizing plus AntD autoSize. No component state, callbacks, draft,
input focus/keyboard handling or feature ownership was changed.

Only source/layout constraint inspection has been performed for this correction;
main-session rebuild and actual macOS expanded/collapsed verification remain the
acceptance authority. No additional browser automation or tests were run by this
worker during this follow-up.
