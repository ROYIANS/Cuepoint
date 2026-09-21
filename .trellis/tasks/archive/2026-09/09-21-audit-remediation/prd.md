# Audit remediation

## Goal and authorization
The user explicitly approved starting the staged fixes in the Chinese full audit report on 2026-09-21. This is implementation of that reviewed plan, not a new product feature. Preserve the audit baseline and report evidence.

## Scope
Fix F01–F13: concurrent drafts; revoked reference replay; final generation connector validation; backup media metadata; unique connector upsert and old duplicates; conflict-aware undo; atomic plan recovery; error redaction; project output projections; decimal editing; keyboard scope; batch draft navigation; outdated copy.
Improve measured shot-list and Agent-route performance, add release quality gates, and resolve D01–D04 with small evidence-backed changes. Preserve provider protocol differences, old project packages and existing local records. No real paid requests or production deployment.

## Acceptance
- All original confirmed-defect reproducers pass with correct assertions promoted to formal tests.
- New regression cases cover same-field conflicts, old-format data, changed configurations and both request protocols where applicable.
- Lint, full tests, build and snapshot verification pass; existing behavior preserved.
- Browser reproductions no longer lose data/change decimal values; buttons and dirty navigation behave correctly.
- Compare production performance on original synthetic datasets; explain measured gains and remaining limitations.
- Chinese delivery maps every finding to implementation, validation and any explicitly unresolved scope.

## Constraints
Use explicit local pnpm /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm and intended Node PATH. No dependency reinstall. Preserve unrelated working tree edits. Existing audit and journal changes are prior task work.
