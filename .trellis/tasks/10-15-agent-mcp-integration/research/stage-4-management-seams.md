# Stage 4 management integration seams

Status: source-backed preparation during Stage 3, 2026-10-16. No UI or browser
delivery is claimed by this note. Requirements remain the approved PRD/design.

## Concrete presentation owners

- Agent ui/AgentControls.tsx owns the composer more menu and the retained skill
  panel entry. Add one MCP connection entry that opens a sibling ContextPanel;
  keep the existing conversation component and execution owner mounted.
- app/layout/context-panel.tsx and ContextPanelHost.tsx already arbitrate one
  retained right panel, guarded replacement, keyboard focus and narrow full-width
  return. Use that contract rather than another modal/drawer implementation.
- Agent ui/InstalledSkillsPanel.tsx is a concrete reference for local draft
  departure, pending/unknown guards, replacement refusal and conditional focus
  return. Its mutations are not MCP authority and must not be reused as such.
- Settings ui/SettingsPage.tsx already locks search/navigation synchronously while
  credential editing is open. ui/settingsModel.ts owns searchable connection
  rows. Add an MCP row under connections and a named feature UI entry. Avoid
  folding external-tool servers into model-provider connector definitions.
- Stage 3's production MCP feature owner must be reused by Agent and Settings.
  Creating a fresh connection owner in each mounted panel would split live
  generations, pending/unknown save intent and invocation authority.

## Minimal useful flow

The list shows saved label, transport/authentication, explicit enablement and
actual connected generation. Empty state offers adding a server. A detail editor
collects explicit local executable/argument-array/environment or remote endpoint
and none/manual/OAuth configuration. It must never display a stored secret as a
model/context preview or pretend that a missing private read API exposes it.
Replacing private configuration is an explicit save; toggling enablement uses
the existing catalogue mutation without needing to re-enter credentials.

Save and Connect are separate actions. New configurations begin disabled unless
the user explicitly selects enablement. Pending controls lock synchronously;
unknown save retains the original operation and offers reconciliation, rather
than inviting another save. A committed catalogue with unconfirmed native
publication remains guarded until original confirmation succeeds. Drain progress
and login status are useful only at this opened management surface.

Connect/reconnect uses the current acknowledged revision. Login opens the
native browser only from an explicit action. Disconnect/disable/remove first
retire local eligibility; failed cleanup cannot restore authority. Inspection
shows bounded frozen tool/resource descriptions and schema counts, without
automatic resource reads, link dereference or tool invocation.

## Necessary acceptance

Use actual ReactDOM controls with the production feature/configuration owner and
controlled finite host port. Hold save/connect/login/retire boundaries and assert
duplicate prevention, original unknown reconciliation, quiet success, preserved
drafts and guarded close/replacement. In both wide and narrow host layouts,
opening/closing/resizing the MCP panel must preserve the running chat instance.
Settings search/navigation locks must cover the MCP credential editor too.

Capture actual final model request/context-preview, project ZIP entry bytes and
diagnostics using private configuration markers. Project ZIP currently selects
business/audio/memory/reference rows explicitly, without device settings or
Agent records; test real serialization rather than relying on that source fact.
Server-supplied results remain untrusted user data and are not sanitized into
pretended trusted instructions. Browser transport support and API evidence are
recorded separately in the bounded browser-seam investigation.
