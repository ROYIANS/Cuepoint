# E02 immediate submission and recovery design

## Authorization and boundary

The owner explicitly asked to continue sequential deliveries and commit each completed stage on 2026-10-15. This executes the already requested optimistic Send outcome. Preserve current page-local draft lifetime and scope; no reload persistence, queue/steering, background host, E03 live-token projection or E04 general query cleanup is included. Full regression/build/packaging is deferred to batch integration.

## Owners and flow

AgentChatPage remains the persistent Agent route owner. Before the first await, validate the current gesture, claim the existing synchronous send lock, capture exact draft/reference revisions, allocate stable submission identities and register a session-local attempt. Consume only the submitted draft snapshot and synchronously register a lightweight user bubble (preparing remains internal; existing composer feedback owns normal progress); yield a bounded browser rendering opportunity before asynchronous preparation. Later draft edits remain independent. No provisional row is written to ProductStore or offered as model history.

A first send from home changes to provisional ChatWorkspace immediately, before waiting for model compatibility or thread creation. The exact newly created row may temporarily support the workspace while its scoped observation catches up. Do not bypass ordinary missing/foreign-route gates. Bind thread identity before navigation as today; preserve the stable Agent owner and a stable presentation key for that attempt's home-to-thread transition. Submitted content must remain visible in the rich MessageList Suspense fallback.

Existing executeNewChatMessage retains compatibility checks, project/task ownership, Web Lock, atomic beginAgentRun, current credentials and normal execution. Optional caller-created IDs in createChatThread and beginAgentRun associate the provisional attempt with durable thread/user/run/assistant records without a schema change. A read-only reconciliation reader checks the complete identity tuple inside one StoreTx and distinguishes absent, accepted and inconsistent records. A copied optional expectedOwner guard checks the frozen project binding inside begin’s transaction (including intentionally unbound threads), closing the race between reconciliation and admission. Duplicate/mismatched IDs fail atomically; no accepted run is automatically replayed on retry.

The UI deduplicates against the matching durable user ID at render time. Keep a provisional attempt until its actual durable counterpart is available; command resolution alone must not cause a blank gap. A late durable observation suppresses a stale pending/failed bubble without a second user turn. Model execution errors after known admission belong to the existing durable run UI.

Owner review correction: normal submitted/accepted user bubbles show content without a transient side status line. Remove 正在发送/已发送正在载入 beside the bubble. Actionable failure/unknown/recovery controls remain available; E03 phase feedback belongs to the composer execution strip.

## Failure and recovery

Preparation or proved rollback failure keeps the submitted payload and exact attachments in the attempt row, offers explicit retry and safe restoration to the original scoped composer. Restore compares the consumed draft generation and current text/reference state; refuse to overwrite any newer mutation, including edited-back-to-empty text or changed attachment selection. Keep the failed card available when restoration is refused. Do not silently move later home edits to the newly created thread.

A storage acknowledgement failure with unknown certainty is not rollback. Preserve an uncertain attempt, do not delete the possibly committed thread and do not start a paid request. Explicit Check send status reads the frozen identities. Read failure or partial/mismatched records remain unresolved. A matching accepted attempt retires its duplicate echo when observed but retains a local explicit 查看恢复选项 control. This action uses the existing thread lock/recovery path without a model request, converting a genuinely abandoned running row into the existing resumable/interrupted presentation; it refuses any live competing owner. Only then can ordinary explicit regeneration/tool continuation proceed. Status reads never mutate or dispatch, and positive evidence never re-enters initial execution. An absent read after an unknown commit does not prove rollback and never permits re-admission or deletion in this delivery. Proved rollback failures may retry explicitly under the same attempt identity after a fresh identity check.

Stop before admission keeps a recoverable unsent payload. Stop after admission follows existing run settlement. Same-tick repeated gestures share the existing lock and cannot allocate a second active attempt. All asynchronous callbacks check current attempt/scope so completion cannot overwrite another conversation's UI or draft.

## Compatibility and data

No schema/version/migration, new dependency, provider protocol or shared Agent-core change. Existing commands remain valid when optional identity is absent. Retry of a durable interrupted run continues to use retryOfRunId and the existing frozen context contract. Unsent attempts are memory-local like existing compose drafts and are not a crash-proof outbox.

## Main risks

- Home navigation can temporarily render the global loading gate; exact created-target hydration must retain the provisional view.
- Lazy rich transcript must not hide the immediately submitted payload.
- Draft acknowledgement/transfer must not refill submitted text or erase a later draft.
- Uncertain commit, existing accepted IDs and late observation must never lead to a second admission/paid dispatch.
- Keep E01 shot details, main transcript scroll ownership and inert focus protections intact.
