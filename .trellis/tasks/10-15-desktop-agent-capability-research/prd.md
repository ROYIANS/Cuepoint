# Desktop Agent capability research and evolution planning

## Closure (2026-10-16)

Investigation and scope handoff are complete. On 2026-10-16 the owner requested archival and cancelled E12–E15. Original proposals below remain research evidence; no further development is activated by this record.

## Goal

Compare the local DeepSeek Harness implementation with Cuepoint and identify
which mechanisms can expand desktop Agent capability while preserving reusable
libraries and the existing creative-product guarantees. The owner will choose
development scope after reviewing the investigation.

## Authorization and boundaries

On 2026-10-15 the owner requested investigation of
`/Users/xiaomengdao/WebstormProjects/deepseek-harness`, then selected
“创建调研任务，调查后再定开发范围”. This authorizes research and planning records.
It does not select an implementation architecture, feature phase, dependency,
platform rollout, permission default or migration. The original research authorization was planning-only; the completed investigation is now closed for archival.

## Source baseline

- Cuepoint: `/Users/xiaomengdao/WebstormProjects/aifenjing`, `main`,
  `9d1a41739b17be27cf832326de15a9489017825a`.
- DeepSeek Harness: `/Users/xiaomengdao/WebstormProjects/deepseek-harness`,
  `master`, `571902028a75c64c1d767f4ae5fd099485f0ddf0`, version `0.2.1-alpha.3`.
- Both worktrees were clean when inspected. DeepSeek Harness describes itself
  as developer preview; package availability does not establish stability or
  default product activation.
- Cuepoint recently extracted `@cuepoint/agent-core` and
  `@cuepoint/agent-providers`. The prior reuse requirement remains authoritative:
  reusable mechanisms stay free of Studio, UI and concrete storage dependencies.

## Research requirements

- R1: Establish current execution, tool registry, permissions, context,
  persistence and desktop-host behavior in both repositories using file/line
  anchors. Distinguish source behavior, documented limits and unexecuted claims.
- R2: Compare local filesystem/shell/processes, Skills, MCP, subagents, jobs,
  scheduling, programmatic tool calling, browser/computer use and observability.
  Separate default composition, optional support and experimental providers.
- R3: Identify Cuepoint mechanisms to preserve: business-aware tools, reviewed
  project memory, exact generation confirmation, local atomic effects/results,
  unknown-effect handling, provider continuation and shared Web/desktop product.
- R4: Propose staged options with concrete creative-product workflows, likely
  code ownership, dependencies and acceptance examples. Recommendations remain
  proposals until the owner chooses scope.
- R5: Evaluate adopting mechanisms, selected dependencies or an external Harness
  worker versus replacing the core; state the integration consequences rather
  than assuming a framework migration.
- R6: Audit interaction design as part of the comparison, following the owner's
  explicit 2026-10-15 correction: sending a message should update the interface
  immediately before waiting for requests. Trace optimistic user-message/draft
  presentation, loading/first-token timing, approvals, cancellation, navigation,
  failures/retry, streaming, scroll and background-progress feedback. Separate
  provisional presentation from durable acceptance and confirmed tool success;
  identify concrete code-backed deficiencies rather than inferring runtime lag.
  Include a bounded spot-check of adjacent project/asset/import interactions to
  identify inconsistent pending, duplicate-submit, error and progress behavior;
  do not describe this sample as a full-product UX or performance audit.

## Acceptance criteria

- AC1 (R1/R2): A source-backed comparison matrix and concise findings exist under
  `research/`, tied to the exact local revisions above.
- AC2 (R2/R3): The report explicitly distinguishes persistent records from live
  background execution, approval from OS confinement, and experimental UI
  automation from default shipped capability.
- AC3 (R3/R4/R5): The recommendation preserves the actual shared core and product
  transaction owner, gives a staged direction and identifies decisions still
  needed from the owner.
- AC4 (R1-R5): Investigation does not run reference-repository applications,
  install dependencies, call paid models, change product source or mutate GitHub.
  Research files and context references validate; no implementation is activated.
- AC5 (R6): A separate interaction audit maps click-to-visible-state timing in
  both products, classifies actual findings versus measurement hypotheses, and
  proposes observable UX acceptance examples without implementing changes.

## Development decisions deferred

Follow-up on 2026-10-15: the owner authorized [Agent experience and desktop evolution](../10-15-agent-experience-desktop-evolution/prd.md) as a parent for all investigated improvements and sequential delivery, adding noninterrupting right-side details. This investigation is now its evidence child. Its research findings remain valid; concrete delivery decisions and new owner answers live in the parent/owning children rather than being retroactively treated as decisions made during this investigation.

The first user-facing workflow, filesystem grants, process isolation policy,
background-execution lifetime, host language/process choice, Skill/MCP trust and
distribution model, and supported platform sequence are undecided. Research
should narrow these decisions without choosing them on the owner's behalf.
