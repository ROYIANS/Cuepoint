# UI/UX overhaul: concise copy, clear states, sidebar status indicators

## Goal

Make Studio and the Agent chat feel like Cursor / Codex / deepseek-harness (dsh): little text, states a user can act on, errors where the user is looking. Inputs: `research/copy-and-state-audit.md` (our inventory) and `research/reference-ux-patterns.md` (rules R1-R15).

## Requirements

### R1. Conversation sidebar item
- Status marker moves to a fixed leading cell (about 16px) before the title; the trailing area keeps only time/actions.
- Running uses the existing dot-matrix animation (`ThinkingMatrix`-style 3x3), not the rotating ring; one shared timer for all rows, static pattern under reduced motion.
- Unread dot is in the same leading cell. Precedence: needs-your-action, then running, then error, then unread, then none (dsh `Rows.tsx:345-398`, Cursor conventions).
- Waiting for approval gets a visible marker (today screen-reader only). The read-failure `!` glyph becomes a proper error marker.
- No layout shift between states; row height unchanged; the delete/time affordance still works.

### R2. Remove redundant text
- Drop page-header and empty-state descriptions that restate the title or read like tutorials (about 20 sites); keep one short line only where an action is needed.
- Trim explanatory settings rows (Update, Storage, Appearance, General) to label + control.
- Remove duplicated helper/“can't confirm the save” paragraphs where a single status suffices.

### R3. Plain-language states
- Replace internal wording (`受理`, `待核实`, `修订`, `版本 N`, 'uncertain outcome', submission-recovery jargon) with short user terms and one clear action (e.g. Retry / Check / Skip). Keep revision numbers only where users compare versions.
- Shared status vocabulary (Running, Needs your approval, Needs input, Failed, Done) used by sidebar, run details, batches and jobs.

### R4. Error placement
- One error surface per context: inline at the failing control or a single strip above the composer; persistent failures are not toast-only; transient confirmations may be toasts. Dedupe stacked messages (composer strip showing 4+ items; `AgentGenerationBatches` ~7 alert surfaces; duplicated backup-failure toast logic).
- Errors are one short sentence plus one action; details expandable, not inline.

### R5. Consistency
- Central copy/status tokens so the same state reads the same everywhere; i18n resources stay in the existing mechanism.

## Constraints

- No behaviour change to data, execution, or the E01-E11/E16 guarantees; accessibility labels kept (and added for new markers); reduced-motion honoured; existing tests updated rather than weakened.
- Visual changes verified in the real UI (screenshots) for sidebar states, composer errors, batch review, settings.

## Acceptance Criteria

- [ ] Sidebar states (idle, running, unread, approval, error, running+unread) render with a leading marker; screenshots attached; no layout shift.
- [ ] Audit top-10 offenders resolved or explicitly deferred in `research/deferred.md`.
- [ ] No stacked duplicate error messages in the composer strip; persistent failures have an inline surface.
- [ ] Copy changes covered by updated tests; `tsc -b`, affected vitest lanes and lint pass.
- [ ] Reduced-motion and a11y labels verified.

## Out of scope

- E11 process boundary; new product features; visual redesign of brand/theme beyond the listed items.
