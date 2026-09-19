# Implementation plan

Status: approved via “开始”, implemented and validated on 2026-09-19; committed as 6b6289b; archival approved.

1. Add project-binding domain types, Dexie fields/version and repository cascade
   contracts. Verify all thread/task/run creation paths require or intentionally allow
   project selection according to the final composer mode contract.
2. Implement a bounded project context projection and fingerprint from current
   business tables, with coverage metadata and current project records. Integrate it
   into `beginAgentRun`/continuation without rewriting frozen requests.
3. Freeze project scope in `AgentToolContext`; enforce destination ownership across
   business and generation tools. Permit only explicit studio-to-project copying;
   add same-project current snapshot to write previews and next request.
4. Add searchable composer project picker, selected-project pill, task/thread labels,
   unavailable/deleted state and context inspector category. Keep mobile/keyboard
   behavior flat and consistent with existing composer menus.
5. Add tests for no-project Task-mode send, same-project new chat, cross-project
   rejection, studio import, same-run refresh, another-tab update, deleted project,
   generation apply scope, task inheritance and retries without duplicate effects.
6. Run local `pnpm` lint/test/build, `git diff --check`, and disposable Edge fixtures
   at desktop/mobile sizes. Check current task wrap-up regression and context budgets.

Risk checkpoints: no prompt-only owner checks; no global project fallback; no hidden
full-project transcript injection; no business writes outside the frozen scope; no
legacy migration work; no memory retrieval claims in this child.
