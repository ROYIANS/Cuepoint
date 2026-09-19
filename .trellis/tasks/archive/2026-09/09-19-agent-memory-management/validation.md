# Validation — project memory management

Date: 2026-09-19. Scope: approved project memory management child, no retrieval/prompt injection.

## Automated quality gate

- Local pnpm `/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm lint`: passed.
- Full Vitest suite: **61 files, 766 tests passed**.
- New focused coverage: project memory repository **9**, project memory packages **10**;
  existing project package tests **17** passed with these changes.
- Production build passed, 12,503 modules. Existing large-chunk advisory remains
  (agent chunk approximately 8.16 MB uncompressed); no build failure.
- `git diff --check`: passed.

## Independent review and fixes

Reviewer checked full repository → package → UI path against approved task and specs.
All six initial findings and the final read-error finding addressed:

1. Promotion editor now belongs to stable TaskWrapup host, surviving summary refresh,
   with inspector editing/pending guards.
2. Stale edits show newest memory and require explicit reconciliation before revision
   advances; local draft is retained.
3. Imported topic keys normalize with CRUD helper across current and historical rows;
   two full-width/whitespace activation/conflict regressions added.
4. Existing pending/disabled activation conflict offers explicit dual-CAS replacement.
5. Imported source evidence is visible before review/activation.
6. Successful promotion has a record-specific project memory link. Duplicate copy no
   longer falsely claims automatic navigation.

7. Editor/detail live queries convert storage failures to local error states. Inline retry
   keeps drafts mounted; submitting is disabled until reads recover.

## Real-browser regression

`validation/browser-regression.cjs` runs against local Vite port 5185 with installed
Playwright and headless Microsoft Edge, a fresh isolated context, no API requests or
paid generation. Project/task/summary rows are fixture data only.

Passed at desktop 1440×1000 and mobile 390×844; browser page errors: **none**.

- Create/select/read memory and historical versions.
- Concurrent editor update → latest-content comparison → keep local draft → save.
- Inject `projectMemories.get` failure during live edit: local error shown, draft intact;
  restore storage reader and retry, then save successfully.
- Disable and reactivate with live detail refresh.
- Cancel dirty editor → continue editing → discard explicitly.
- Source confirmed-summary promotion → edit formulation → another summary created →
  draft remains → save → deep link selects result.
- Delete source chat → promoted memory and excerpt remain, live source marked missing.
- Mobile returns to list, creates/editor Escape, no horizontal viewport overflow.
- Export/import project ZIP in browser → imported entries pending review.
- Activate old imported same-topic entry, activate new → conflict → explicit replace.
- Permanently delete replacement → old entry/history remains superseded.
- Attempt route navigation while editing → guard → continue → draft preserved.

## Deliberate limits

This child organizes reviewed local knowledge. Model retrieval and automatic prompt
inclusion are the next child; no current answer claims AI already consumes memory.
Exact/topic matching does not claim semantic contradiction detection. Historical or
imported evidence cannot establish that the current project still satisfies a decision.

Final independent re-review: all seven findings closed; no remaining findings.

## Commit readiness

Implementation and quality checks complete. User approved grouped commits per
Trellis Phase 3.4; implementation committed as 2fedc10. Archive task and append developer journal next. No remote push.
