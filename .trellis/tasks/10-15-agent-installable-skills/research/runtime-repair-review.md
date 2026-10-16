# E09 runtime and uncertain-toggle repair

Date: 2026-10-16. Owner requested fixing the two review findings after source
delivery. Independent Trellis check: **PASS**, no additional corrective edit.

## Findings and repairs

### P1 — browser consumed an obsolete public package entry

`packages/agent-core/src/index.ts` already exported `formatSkillCatalogue` and
the other E09 helpers. The running Vite server predated those source changes and
still served the old ignored `dist` output. Source-alias test passes could not
establish that this real emitted entry provided the new exports. The startup
freshness assertion had not rerun after the library changes.

Explicitly ran the existing `tooling/build-agent-packages.mjs` with the approved
machine Node and matching PATH. It refreshed the reusable Agent libraries in
their dependency order. `assertAgentPackageFreshness()` and direct emitted-entry
checks then passed. No production source alias, generated-dist commit, package
reinstallation or receipt bypass was added. Specs now require this explicit
runtime dependency preparation when an active app consumes changed public exports.

### P2 — unknown storage result visually rolled back an accepted toggle

`useInstalledSkills.mutate()` unconditionally cleared the optimistic value in
`finally`, even when the write result was unknown and the original operation
remained quarantined. The checkbox could consequently display the old value
while the write had committed or was still in progress.

The shared controller now preserves the requested value across unknown results,
unresolved or failed receipt reads, menu reopening and retained-panel transfer.
Known failures still roll back. A successful acknowledgement or reconciled
commit attaches the receipt's catalogue revision to that value; an older list
or a failed follow-up read cannot undo the confirmed display. A catalogue at
that revision or newer supplies the authoritative state. Conflict resolution
clears the captured intent only after the explicit current-list acknowledgement
successfully reads the catalogue. Existing quarantine, departure guards and
no-replay behavior remain in place; no extra UI caption was introduced.

## Verification

- Actual temporary Edge browser opened the running Vite `/agent` route with an
  empty local profile. The expected no-connection Agent page rendered normally,
  page exceptions were empty, and direct browser module import confirmed
  `formatSkillCatalogue` and `splitSkillDocument` as functions and `SKILL_LIMITS`
  as an object. No live model request or user-profile mutation was required;
  the temporary browser and profile were cleaned up, leaving Vite running.
- Main session checked all seven E09 public runtime values through the emitted
  entry and the actual Vite module. Independent review also checked freshness
  and the six function exports through the real `@cuepoint/agent-core` entry.
- Implementer: finite source-profile `installedSkillsUi.test.tsx`, **14/14
  passed**, including four added cases. Final noEmit using
  `tests/typecheck/tsconfig.installable-skills-source.json` passed. Full-rule
  hook ESLint: **0 errors / 0 warnings**.
- Independent reviewer: the same **14 distinct UI cases** passed against real
  emitted package resolution, using the normal `vitest.config.ts` and a
  one-run Node API include override below. No source alias was added. Hook
  ESLint independently passed with **0 errors / 0 warnings**. Final noEmit
  receipt was reused after the implementer's files were frozen.
- Both owners' whitespace checks passed; the main session also checks staged
  contents before committing.

All package commands used the explicitly approved machine pnpm and matching
Node, not the Codex runtime package manager. The independent UI invocation was:

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node --input-type=module -e 'import { startVitest } from "vitest/node"; const ctx = await startVitest("test", ["tests/installedSkillsUi.test.tsx"], {config: "vitest.config.ts", run: true, include: ["tests/installedSkillsUi.test.tsx"]}); if (!ctx) process.exitCode = 1; else { const failed = ctx.state.getFiles().some(file => file.result?.state === "fail"); if (failed) process.exitCode = 1; await ctx.close(); }'
```

## Limits and deferred acceptance

The normal shared Vitest discovery currently includes `.test.ts` but excludes
`.test.tsx`; directly selecting this TSX file with that profile reports no tests.
The one-run include override above establishes actual emitted UI behavior for
this repair. It does not fix or claim complete aggregate TSX discovery; review
that existing coverage gap during the epic batch quality work. The finite E09
source profile explicitly includes the UI test.

Refreshing reusable-library output and loading it in Edge is narrower evidence
than a full application build, isolated packed-consumer/declaration acceptance,
or installed macOS/Windows flows. Those gates remain pending at the agreed
epic-end cadence. E09 stays active as `source-complete-pending-batch`.
