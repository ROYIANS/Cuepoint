# Normal browser acceptance

## Executed scope

The main session ran the normal built browser application with Chromium 151 in
a fresh disposable profile at 1440 × 900. This used `apps/web/dist` and the real
browser IndexedDB owner; it did not import a fixture entry or replace business
commands. Entry asset was `index-CSxlB1Nu.js`, SHA-256
`b467e29d3800bb5b540b14aaf32a93a0d757c3bff251e4985630db9ce4b5ff2f`.
This run was performed before independent review found that Tailwind's relative
source root had narrowed when the stylesheet moved. Its route/mutation outcomes
remain observed, but this asset is superseded for final acceptance. A corrected
build and repeated browser/stylesheet check are required below; the first run is
not visual-equivalence proof.

## Corrected build acceptance

After restoring Tailwind to `source("..")`, the main session repeated the full
script in another fresh profile against entry `index-JghuaXdB.js`, SHA-256
`7fbaf16ca9aeddfd180c0a23a0ebc3713032d017fe80a4957c81e6235b09cdba`.
All route/create/Audio chapter-and-track/reload/persistence assertions below
passed again: three projects, two Audio chapters and two Audio tracks, with
zero runtime exceptions or failed same-origin resources. The main session
visually inspected the corrected Audio and Video screenshots as well.

The actual web output's CSS contains all five independently identified
feature/print selectors: `max-w-6xl`, `tracking-[0.18em]`, `text-black/55`,
`mt-12` and `print:grid-cols-2`. This confirms those omitted classes are now
emitted from the restored source scope. The CSS correction is a necessary
path-sensitive configuration change; equal old/new stylesheet bodies alone
would not have detected it. Final acceptance uses this corrected build identity.

## Observed behavior

- Direct navigation to Agent, settings and materials rendered their expected
  empty/configuration states. Settings remained usable with no saved connector.
- Real project-creation buttons, dialog type choices and project-name inputs
  created Audio, Music and Video projects, one of each.
- Audio rendered the actual workspace. The real “新增章节” action created its
  second chapter and voice track. A page reload retained both chapters; a
  readonly IndexedDB read confirmed two chapter rows and two track rows for
  that Audio project.
- Music rendered its actual creation form, draft selector and empty work
  library. No generation was requested.
- Video navigated from the created project to its actual first-episode story
  URL and rendered the story editor.
- The database contained exactly the three created projects with their expected
  kinds. The fixed browser namespace was `aifenjing`. Runtime exceptions and
  failed same-origin resource responses were both empty.
- The main session visually inspected all three workspace captures; their
  normal frame, navigation, controls and empty content rendered at the tested
  dimensions.

The first automation attempt stopped because its final Audio text locator
matched both a navigation link and the page heading. The corrected attempt
targeted the actual heading, started with another fresh profile and passed all
the same behavioral assertions. No product or permanent test was changed to
resolve that harness ambiguity.

## Evidence and limits

Raw script, JSON, failure log and PNG captures are under
`/tmp/cuepoint-feature-browser*`; only this authored conclusion is retained in
the task. The browser profile was removed after execution, leaving no user
projects or settings changed.

This establishes normal browser route/resource loading, project dispatch,
actual creation and a persisted Audio mutation at one desktop viewport. It
does not establish native WebView/Save/reopen, recording permissions, decoded
playback, paid providers, narrow-screen layout or pixel equivalence with the
historical E03 stylesheet comparator. The predecessor's finite B01/E03 and
other-host/deployment limits remain explicit.
