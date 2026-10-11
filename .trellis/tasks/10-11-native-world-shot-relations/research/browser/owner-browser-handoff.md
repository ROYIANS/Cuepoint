# Browser acceptance handoff

The delegated browser-only UI acceptance did not start: `cua.getTab('2', {browser: 'iab'})` returned `Browser is not available: iab`, then the read-only browser inventory returned `[]`. The root reported that its own CUA namespace has the existing Codex in-app browser, so this is a subagent surface-availability limitation. No other browser or native app was selected, no page was opened or mutated, and no screenshot/AX state was available.

The exact availability results are recorded in `owner-cua-availability.json`. They are blocker evidence only, not application behavior evidence. All requested actual UI checks remain **pending** and should be performed in the root's bound tab.

## Requested isolated root lane

These target details came from root dispatch and were not independently verified here:

- Existing IAB tab ID `2`; isolated origin `http://127.0.0.1:5176/` and current `/agent` route.
- Root-created project `浏览器隔离回归`, ID `prj_ef917f70-9313-4853-aded-b798364c8eaa`.
- Episode ID `ep_40bdb51a-96bd-43a2-8748-d57f57cfb0a4`.

## Actual UI checks still required

1. Open projects through the UI and confirm the named isolated project is visible. Confirm the actual visible catalogue does not include the native acceptance project's title. Save AX and screenshot evidence before editing.
2. Open its story page, edit logline and script through their actual controls, wait for visible saved status, reload and verify both exact texts remain. Capture the persisted UI evidence. Do not write IndexedDB or product state through evaluation.
3. Check the world tabs, material library and help page through UI navigation and capture their current headings and controls. Check visible connector status without opening or reading secret values; do not send a real provider request.
4. Trigger the browser project's real ZIP backup control and inspect the downloaded artifact's ZIP structure, expected edited records and absence of connector/key records. Keep this actual browser artifact evidence separate from deterministic `runtimeSave` tests.
5. If the IAB's file chooser exposes a safe cancel action, trigger import and cancel; verify the pending state clears and no project is imported. If the chooser is inaccessible, record that specific item pending rather than reporting a cancellation pass.

No browser or packaged acceptance pass is claimed by this handoff. All product source remains frozen; this subtask changed only its two evidence/handoff documents.
