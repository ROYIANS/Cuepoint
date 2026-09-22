# Design

Reuse existing shadcn DropdownMenu as controlled menu anchored to right-click coordinates, with toolbar trigger equivalent. Targets capture clip/track revisions so concurrent edits conflict rather than redirecting actions. Existing AudioClipHistory gains duplicate (new ID, same take and trims, placed at source end) and remains the only clip mutation path. Scope keyboard to timeline root focus, ignore inputs/overlays and drag/busy state. Pure shortcut resolver for regression tests. No multiselect, ripple deletion, source removal or track-delete cascade in this pass.
