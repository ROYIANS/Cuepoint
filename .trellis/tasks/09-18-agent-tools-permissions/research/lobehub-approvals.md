# LobeHub approval reference

Read-only source: `/Users/xiaomengdao/WebstormProjects/lobehub/packages/agent-runtime/src/executors/humanApprove.ts`.

- Persist pending calls and their exact assistant/run ownership before waiting for human input.
- Rehydrate the authoritative pending records; do not infer their parent from the most recent assistant message.
- Approved/rejected results form one complete assistant/tool chain, not an empty placeholder plus a second duplicate tool result.
- Parking is nonterminal. It must not claim the task completed or retain an active spinner forever.

Cuepoint stores these identities and decisions in IndexedDB, releases the thread Web Lock while waiting, and reacquires it before resumption. UI persists refusal independently of connector availability. New permission defaults cannot retroactively approve existing requests.

Server stream transports, hooks and distributed state orchestration are not ported. Unknown interrupted effects stay unresolved and cannot be blindly replayed.
