# Implementation boundary

Approved by the user on 2026-10-10 after the final design review.

The current gap is inconsistent functional headings, page spacing, navigation geometry, surface colors, and overlay scrolling across existing page owners. Presentation lives in styles.css, StudioShell, WorkspaceChrome, feature TSX/CSS and existing Radix primitives. Fix those owners; keep route adapters, Dexie schema, business commands, scoped drafts, generation approval, transport and runtime hosts intact.

Foundation owns src/styles.css, src/components/layout/*, StudioShell, WorkspaceChrome, LibraryHeader, CoverCard, ProjectGalleryPage, MaterialLibraryPage, materialLibrary.css and overlay primitives. Studio migration owns remaining studio pages/CSS. Video migration owns assets/story/shots/produce and EpisodeListPage presentation. Media migration owns audio/audioMusic/music/memory presentation. Agent migration owns agent presentation and local theme adapters, not executor/runtime logic. Root owns Trellis artifacts/specs, integration fixes and evidence. No worker edits peer-owned files without coordination.

The shared presentation API is frozen here before consumer migration:

- src/components/layout/PageLayout.tsx exports PageHeader({title: ReactNode, description?: ReactNode, count?: ReactNode, back?: ReactNode, actions?: ReactNode, dense?: boolean, className?: string}), PageToolbar(props: React.ComponentProps<"div">), PageContent({mode?: "collection"|"detail"|"document"|"workbench", ...divProps}), PageState({title: ReactNode, description?: ReactNode, action?: ReactNode, kind?: "loading"|"empty"|"missing"|"error", compact?: boolean, className?: string}). PageHeader owns h1. PageContent only controls width/padding, never scroll or state. No data hooks.
- src/components/layout/AppFrame.tsx provides shared navigation + window filling presentation to StudioShell/WorkspaceChrome; each retains its existing business owner. Foundation chooses internal props and coordinates callers it owns.
- Existing Dialog/AlertDialog/Sheet primitives own constrained-height flex layout and scrollable body support; retain focus, pending/dirty guards and Portal. Feature owners may opt into explicit flex body/footer when content requires.
- Functional page h1: 24/600/32 (20/600/28 narrow); dense 20/600/28. Body 14/22; metadata 12/18. Navigation/app/panel/elevated use semantic neutral tokens. Existing shadcn control geometry retained.

Validation: native screenshots/DOM geometry, keyboard/resize/overlay behavior and relevant existing owner tests demonstrate unchanged behavior. Full lint/test/quality/self-test/model-bank/build gates plus independent review are required. Pure presentation does not need mirrored implementation tests. Any genuine interaction change gets focused behavioral validation. Print remains white A4 landscape and episode scoped. Future OS shell, packaging, commands, paid generation and user data deletion are outside this change.
