# Existing image path evidence

Date: 2026-09-19.

- referenceTools.ts `read_project_image` reads project-owned generated or imported pixels and requires frozenProjectScope.
- references.ts `searchProjectReferences` uses ready/partial registered references and chunks, excluding unregistered slot outputs.
- businessStore projection includes parsed slot results; summaries lack explicit image availability.
- referenceContext validates all input owners against one project; referenceWire materializes pixels and revalidates after asynchronous encoding.
- db/agentTools appendToolResults pairs allowed reference-tool results into typed user inputs exactly once. Inspect its explicit tool-name filter when adding discovery.
- referenceEvidence summarizes source reads separately from creative result evidence. Keep this distinction for unbound image reads.
- Current context compression removes old pixels; run-scoped tool provenance must not accidentally grant new-run access.

The user's exact original failed run has not been inspected. These are confirmed implementation gaps, not a claim of reproducing its single root cause.

## Additional availability gate

`memoryToolNames.ts:filterProjectMemoryTools` currently removes every REFERENCE_TOOL_NAMES entry from unbound runs. New discovery and discovered read must be deliberately retained for unbound smart mode, while document/reference search/read and project memory tools remain scoped. The same filter feeds context preview and durable run creation; change and test both. Without this change a correct reader is still invisible to the model.
