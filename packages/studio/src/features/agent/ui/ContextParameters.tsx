import {type RefObject, useEffect, useRef, useState} from "react";
import {Input, InputNumber, Switch, type InputRef} from "antd";
import {ArrowLeft, Restore} from "../../../ui/icons";
import {useProductQuery} from "../../../platform/product/queries";
import {toast} from "sonner";
import type {ProductStore} from "../../../platform/storage/types";
import {GENERAL_AGENT_ID} from "../models/agent";
import type {ContextPolicy} from "../models/context";
import {normalizeContextPolicy} from "../runtime/contextPolicy";
import {resetThreadContextPolicy, saveContextPolicyAsDefault, updateContextPolicy} from "../commands/contextSettings";
import "./contextParameters.css";

async function readPolicySource(threadId: string | undefined, scopeKey: string, db: ProductStore) {
    try {
        return {
            scopeKey,
            source: (threadId ? await db.chatThreads.get(threadId) : await db.agents.get(GENERAL_AGENT_ID)) ?? null,
            error: undefined
        };
    } catch (error) {
        return {scopeKey, source: null, error: error instanceof Error ? error.message : "参数暂时无法读取"};
    }
}

function policyReadStatus(state: Awaited<ReturnType<typeof readPolicySource>> | undefined) {
    if (!state) return {message: "正在读取参数…", role: "status" as const};
    if (state.error) return {message: state.error, role: "alert" as const};
    if (!state.source) return {message: "参数所属对话或助手已不存在", role: "alert" as const};
    return undefined;
}

export function ContextParameters({threadId, onBack, search = "", onSearch, searchRef}: {
    threadId?: string;
    onBack: () => void;
    search?: string;
    onSearch?: (value: string) => void;
    searchRef?: RefObject<InputRef | null>;
}) {
    const scopeKey = threadId ?? GENERAL_AGENT_ID;
    const loaded = useProductQuery((db) => readPolicySource(threadId, scopeKey, db), [scopeKey, threadId]);
    const state = loaded?.scopeKey === scopeKey ? loaded : undefined;
    const policy = normalizeContextPolicy(state?.source?.contextPolicy);
    const [saving, setSaving] = useState(false);
    const owner = useRef({scopeKey, live: true, locked: false});
    if (owner.current.scopeKey !== scopeKey) {
        owner.current.live = false;
        owner.current = {scopeKey, live: true, locked: false};
    }
    const session = owner.current;
    useEffect(() => {
        session.live = true;
        return () => {
            session.live = false;
        };
    }, [session]);
    const save = async (action: () => Promise<void>, message?: string) => {
        if (!session.live || owner.current !== session || session.locked || !state?.source || state.error) return;
        session.locked = true;
        setSaving(true);
        try {
            await action();
            if (session.live && owner.current === session && message) toast.success(message);
        } catch {
            if (session.live && owner.current === session) toast.error("保存参数失败，请重试");
        } finally {
            session.locked = false;
            if (session.live && owner.current === session) setSaving(false);
        }
    };
    const patch = (value: Partial<ContextPolicy>) => void save(() => updateContextPolicy(threadId, value));
    const status = policyReadStatus(state);
    const editable = !!state?.source && !status;
    const disabled = (saving && session.locked) || !editable;
    const query = search.trim().toLocaleLowerCase();
    const match = (label: string) => !query || label.toLocaleLowerCase().includes(query);
    return <div className="agent-control-panel agent-parameters">
        <div className="agent-sheet-toolbar">
            <button type="button" className="agent-skill-back" aria-label="返回" onClick={onBack}><ArrowLeft size={16} aria-hidden/></button>
            <div className="agent-skill-search"><Input variant="borderless" ref={searchRef} value={search}
                                                       onChange={event => onSearch?.(event.target.value)}
                                                       placeholder="搜索参数…" aria-label="搜索参数" allowClear/></div>
        </div>
        <div className="agent-parameter-body">
            {status && <p role={status.role}>{status.message}</p>}
            {match("自动压缩上下文") && <div className="agent-parameter-row"><label htmlFor="context-auto"><strong>自动压缩上下文</strong></label><Switch
                aria-label="自动压缩上下文" id="context-auto" size="small" checked={policy.autoCompress} disabled={disabled}
                onChange={(autoCompress) => patch({autoCompress})}/></div>}
            {match("限制历史消息") && <div className="agent-parameter-row"><label htmlFor="context-history"><strong>限制历史消息</strong></label><Switch
                aria-label="限制历史消息" id="context-history" size="small" checked={policy.limitHistory}
                disabled={disabled} onChange={(limitHistory) => patch({limitHistory})}/></div>}
            {policy.limitHistory && match("限制历史消息") &&
                <div className="agent-parameter-detail"><label htmlFor="context-history-count">最多携带</label><InputNumber
                    id="context-history-count" aria-label="历史消息条数" min={0} max={10000} precision={0}
                    value={policy.historyMessageCount} disabled={disabled} onChange={(count) => {
                    if (count !== null) patch({historyMessageCount: count});
                }}/><span>条</span></div>}
            {match("高级预算") && <details className="agent-parameter-advanced">
                <summary>高级预算</summary>
                <label htmlFor="context-local-budget">本地上下文预算</label><InputNumber
                id="context-local-budget" aria-label="本地上下文预算" min={2048} max={10000000} precision={0}
                placeholder="采用模型上限" value={policy.customContextTokens} disabled={disabled}
                onChange={(count) => patch({customContextTokens: count ?? undefined})}/></details>}
            {threadId && <div className="agent-parameter-actions">
                <button type="button" disabled={disabled}
                        onClick={() => void save(() => resetThreadContextPolicy(threadId), "已恢复新对话默认参数")}>
                    <Restore size={13}/>恢复默认
                </button>
                <button type="button" disabled={disabled}
                        onClick={() => void save(() => saveContextPolicyAsDefault(threadId), "已设为新对话默认参数")}>设为默认
                </button>
            </div>}
        </div>
    </div>;
}
