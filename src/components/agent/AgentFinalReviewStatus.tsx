import type {AgentRun} from "@/domain/agent";
import type {FinalReviewPredicate, FinalReviewReason} from "@/domain/agentFinalReview";
import {WRITE_KIND_LABELS, WRITE_OPERATION_LABELS} from "@/lib/agent/runWriteOutcomes";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";
import {Button} from "@/components/ui/button";

const REASONS: Record<FinalReviewReason, string> = {
    budget: "本段请求额度已用完", ineligible: "当前执行或工具状态不满足检查条件", content_limit: "原文超出检查范围",
    context_limit: "检查内容超出模型上下文预算", invalid: "检查返回的文字范围或来源无效", timeout: "检查超时",
    stopped: "用户已停止", interrupted: "检查已中断，刷新不会重新请求", stale: "检查期间原文或证据发生变化", transport: "检查请求未成功完成"
};
const ASSESSMENT = {consistent: "模型判断与所引观察一致", contradicted: "模型判断与所引观察矛盾", unknown: "依据不足，模型无法核实"};
const PREDICATE = {verified: "结构条件已核对", contradicted: "结构条件与记录矛盾", unknown: "结构条件未核实"};
function predicateLabel(predicate: FinalReviewPredicate): string {
    if (predicate.type === "historical_write") return `${WRITE_OPERATION_LABELS[predicate.operation]}${WRITE_KIND_LABELS[predicate.entityKind]} ${predicate.id}${predicate.revision === undefined ? "" : `；当时版本 ${predicate.revision}`}`;
    const label = predicate.type === "output_available" ? "文件可用" : predicate.type === "output_selected" ? "已选用" : "已入轨或采用";
    return `${label}：${predicate.value ? "是" : "否"}`;
}

export function AgentFinalReviewStatus({run}: {run: AgentRun}) {
    const {reveal} = useAgentActivityNavigation();
    const review = run.finalReview;
    if (!review) return run.status === "completed" ? <p className="px-0 py-1 text-xs text-muted-foreground">成果声明未检查</p> : null;
    const checking = review.status === "pending" && run.status === "running";
    const label = checking ? "正在只读检查成果声明" : review.status === "checked" ? "已检查成果声明 · 有界观察" : "成果声明未核实";
    return <details className="py-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer" aria-live="polite">{label}</summary>
        <div className="space-y-2 pt-2 break-words">
            <p>保留原文。模型判断只比较列出的观察；结构条件核对不认证整句、整批完成或试听效果。</p>
            <p>观察是检查时的快照，后续编辑不会更新此记录。</p>
            {review.reason && <p>{REASONS[review.reason]}</p>}
            {review.status === "pending" && !checking && <p>检查已中断，刷新不会重新请求。</p>}
            <p>观察 {review.snapshot.evidence.length} 项；省略 {review.snapshot.omitted} 项；未覆盖的写入调用 {review.snapshot.uncoveredWriteCalls} 项。缺少记录不代表没有效果。</p>
            {review.status === "checked" && !review.claims?.length && <p>模型未提取完成声明，不能据此证明回复没有遗漏或错误。</p>}
            {review.claims?.map((claim, index) => <div key={`${claim.start}-${index}`} className="space-y-1">
                <blockquote className="whitespace-pre-wrap break-all">{claim.text}</blockquote>
                <p>{ASSESSMENT[claim.assessment]}{claim.predicateResult && `；${PREDICATE[claim.predicateResult]}（仅下列条件）`}</p>
                {claim.predicate && <p className="break-all">核对条件：{predicateLabel(claim.predicate)}</p>}
                {claim.refs.map(ref => {
                    const fact = review.snapshot.evidence.find(item => item.ref === ref);
                    if (!fact) return null;
                    return <div key={ref}>
                        <Button variant="link" size="sm" className="h-auto px-0 py-0 text-xs"
                            onClick={() => reveal({runId: run.id, callId: fact.callId})}>查看来源 {ref}</Button>
                        <p className="break-all">{fact.kind === "write"
                            ? `历史直接修改：${WRITE_OPERATION_LABELS[fact.operation]}${WRITE_KIND_LABELS[fact.entityKind]} ${fact.id}；当时版本 ${fact.revision ?? "未记录"}`
                            : `检查时的输出 ${fact.jobId}${fact.resultKey ? ` / ${fact.resultKey}` : ""}：文件${fact.available ? "可用" : "未核实可用"}；选用${fact.selected === undefined ? "未覆盖" : fact.selected ? "是" : "否"}；入轨或采用${fact.placed === undefined ? "未覆盖" : fact.placed ? "是" : "否"}；未试听`}</p>
                    </div>;
                })}
            </div>)}
        </div>
    </details>;
}
