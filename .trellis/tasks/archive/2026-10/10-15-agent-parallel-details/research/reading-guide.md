# E01 required full-spec reading

Context injection has a 32,768-byte per-file bound. Three canonical guidelines exceed that size; do not treat a truncated injected prefix as the complete contract and do not copy/split the canonical specs into task artifacts.

Before implementation or review, explicitly read these files in sequential bounded chunks through their ends. Follow the current versions and the existing `trellis-before-dev` / `trellis-check` workflow.

| Canonical document | Why a complete read matters for E01 |
| --- | --- |
| `.trellis/spec/frontend/component-guidelines.md` | Feature components, actual controls/keyboard behavior, shared presentation and later appended contracts. |
| `.trellis/spec/frontend/state-management.md` | Frozen edit target, touched-field CAS, retained drafts, B01 query scope, D08 text/slot owners and departure behavior. |
| `.trellis/spec/frontend/quality-guidelines.md` | Formal quality/type/full-test/build gates, actual callbacks/store/harness evidence and later native/browser acceptance qualifications. |

Also read the smaller curated specs and [focused source report](../../10-15-agent-experience-desktop-evolution/research/parallel-detail-navigation.md) supplied in the manifests. The report records the accepted full-width business-detail behavior; `desktop-ui.md` still describes the historical narrow modal drawer. Implement and document the owner-confirmed change without weakening unrelated dialogs, navigation or draft ownership.

For E16, re-read these same current contracts plus the final E01 implementation/spec changes before converging its entity coverage and modal-review handoff. This guide is reading orchestration, not an alternate source of product or coding rules.
