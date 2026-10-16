# E09 Stage 1 independent review

Date: 2026-10-16. Scope: the neutral public skill API and its independent host
fixture, Studio's package parser, strict stored-record readers, installation/CAS
commands, retention helpers and physically separate progressive-read queries.
Native import, management UI and actual run/tool lifecycle integration remain
the following implementation stages.

## Fixed finding

`skills/commands/installations.ts:addContent` created manifest/body/resource rows
with `bulkAdd`, but initially omitted the retention row from that insert-only
group. If storage contained an orphan retention row absent from the catalogue,
the later counter `put` replaced it. A real ProductStore regression reproduced
an existing `runReferences: 3` row being silently overwritten by an installation.
This violated the specified fail-closed treatment of corrupt/orphan groups.

The same atomic `bulkAdd` now includes the new retention row. Existing manifest,
body, resource or retention rows reject publication and roll back the entire
group. No orphan counts are adopted or repaired. Counter adjustment remains in
the original transaction, and publication still commits only a nonzero current
reference. Four actual-store cases verify rejection and exact preservation of
the preexisting rows; before the fix, the retention case failed while the other
three already passed.

## Other reviewed contracts

- YAML aliases, explicit tags, duplicate keys, multiple documents and excessive
  nesting reject before conversion; strict UTF-8 decoding and exact BOM/CRLF
  content identities are preserved.
- Pure core exports require no YAML, React, Studio, concrete storage, filesystem
  or Node runtime. The independent byte-map fixture imports the public root.
- Catalogue discovery reads only its metadata row; body access reads the selected
  manifest/document, and resource access reads only its selected manifest row and
  selected resource row, validating length and digest.
- Publication rebuilds the reviewed candidate before entering its actual
  ProductStore transaction. CAS, strict counter reads, serialized quotas and
  operation receipts share that transaction. Unknown outcomes use explicit
  readback; absence of a receipt at an unchanged catalogue is unresolved.
- Pin helpers join the caller's scoped transaction. Update/uninstall retain
  referenced content; collection occurs only after both counters reach zero.
  Late publication, uninstall and final-release faults have rollback assertions.

No unresolved Stage 1 code finding remains after the local correction. The new
portable/installed-skill specs cover the actual interfaces and storage contracts;
the main session owns their final synchronization and the commit.

## Verification and limits

- Finite source Vitest lane: 2 files, 64 tests passed (39 core and 25 Studio).
- Studio source-only noEmit profile: passed, including the affected test files.
- Neutral core noEmit project (`types: []`): passed.
- Existing full ESLint rules with the finite source type profile: 8 production
  files, 0 errors and 0 warnings. No rule was disabled or lint bypass persisted.
- Main-session final architecture gate: passed, 677 files/2,659 edges, zero
  cycles and zero failures. This is the main session's reported result.

No full regression, build, emitted/packed consumer or native/installed acceptance
ran in this review. Those remain at the owner's end-of-epic batch boundary.
Stage 1 fixtures do not establish system picker, native containment, webview UI,
actual model protocols or run-deletion integration acceptance.
