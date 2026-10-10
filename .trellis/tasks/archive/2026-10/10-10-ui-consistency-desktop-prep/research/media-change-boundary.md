# Media and project memory presentation boundary

The audio workspace lacks a functional page heading, music uses a small library heading as its only h1, and project memory uses a promotional heading. Their panel spacing, small supporting text and overlay scrolling also diverge from the approved shared workbench.

Presentation changes belong to AudioWorkspacePage, MusicWorkspacePage, ProjectMemoryPage, MemoryEditor and their owned CSS. Shared audio/music CSS supplies consistent typography and neutral panels. Batch and arrangement dialogs receive an explicit scrolling body so their existing confirmation footer remains reachable in short windows. A small memory Select adapter reuses existing Radix primitives while retaining the existing values, filter callbacks and disabled state.

Do not change repository writes, query ownership, keyed drafts, expected revisions, paid generation arguments/confirmation, timeline coordinate units, waveform geometry, player lifecycle, route dispatch or runtime hosts. Existing media and memory regressions validate those contracts; the main session owns native visual, resize and focus evidence. Pure presentation does not add mirrored component tests.
