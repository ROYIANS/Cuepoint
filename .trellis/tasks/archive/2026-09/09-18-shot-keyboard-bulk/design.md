# Design — 分镜键盘与批量编辑

Document-level keydown listener gated by `event.target` form-field check. Maintain `activeShotId` for highlight separate from multi-select set. Bulk character UI: checklist then write exact `characterIds` array to all selected. Scene/notes/status overwrite. Reuse `registerUndo` snapshots of previous shot patches.
