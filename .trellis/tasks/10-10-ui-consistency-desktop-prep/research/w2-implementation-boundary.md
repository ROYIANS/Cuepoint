# W2 Studio implementation boundary

Shared approved boundary: [change-boundary.md](./change-boundary.md). This work uses the frozen `PageLayout` presentation API and the foundation-owned `LibraryHeader`/`CoverCard`, without changing those shared owners.

Owned files: `IpProfilesPage.tsx`, `IpProfileEditor.tsx`, `ipProfiles.css`, `AssetLibraryPages.tsx`, `ConnectorsPage.tsx`, `SearchConnection.tsx`, `AboutPage.tsx` under `src/components/studio/`.

Gap: separate serif/eyebrow headings, oversized IP spacing, absent initial/loading states in legacy libraries, connector nested card surfaces, native search checkbox and independently scrolling overlay layouts. The fix uses functional sans headings, collection/detail/document width modes, shared toolbar/state and labelled Radix Checkbox. Existing legacy create commands move from a tile into `LibraryHeader.extra`; same guarded handler and Studio URLs remain. Read failures retain the library kind and display an error state, with unchanged underlying table queries. Connection/search reads distinguish loading and read errors from a real unconfigured state; credential write and transport operations are unchanged. The IP editor footer is corrected to the actual existing linked-chat summary contract.

Exclusions: shared asset detail owners, shared layout/styles/primitives, route adapters, schema/domain records, business commands, generation/paid requests, credential storage and transport. Retain IP frozen revision/dirty blocker/error draft and archive guards; connector session/operation identity, redaction, save/test/probe/disconnect differences; Tavily controlled state, busy lock and labelled checkbox; original sponsorship/download entries.

Verification so far: machine pnpm type check passed after the final functional edits; focused six-file suite passed all 160 tests; an earlier full Vitest invocation passed 180 files / 3221 tests with one existing skip; `git diff --check` passed. This is source and regression evidence, not native visual acceptance. Root will check IP list/detail/editor dirty-close and tabs, four legacy collections and menus, safe blank connector dialogs/Tavily checkbox and About sponsorship overlay at approved wide/narrow/short viewports. Screenshots must exclude credentials; no paid or connection mutation needed.

Integration note: flattening connector cards removes the last src consumers of the shared `ui/card.tsx` primitive. Root/foundation owns that file and must resolve formal unused checks, if no new real consumer needs it.

Shared integration completed: `LibraryHeader.description` places the legacy library explanation above its toolbar, and `extra` remains PageHeader actions. IP linked-project metadata uses the existing `PROJECT_KINDS` catalog so audio/music projects no longer receive video-mode labels. Native acceptance remains pending.
