import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgentRun, AgentToolCall } from "@/domain/agent";
import { Button } from "@/components/ui/button";
import { describeRunWrites, WRITE_KIND_LABELS, WRITE_OPERATION_LABELS } from "@/lib/agent/runWriteOutcomes";
import { useAgentActivityNavigation } from "./AgentActivityNavigation";

export function AgentWriteOutcomes({ run, calls }: { run: AgentRun; calls: AgentToolCall[] }) {
  const outcome = useMemo(() => describeRunWrites(run, calls), [run, calls]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { reveal } = useAgentActivityNavigation();
  if (!outcome.total && !outcome.uncoveredCalls) return null;
  return <div className="min-w-0 py-1 text-xs text-muted-foreground">
    <Button variant="ghost" size="sm" className="h-auto max-w-full justify-start gap-2 px-2 py-1.5 text-left text-xs whitespace-normal" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <span className="min-w-0 break-words">{outcome.total
        ? `本次已保存：${outcome.groups.slice(0, 3).map((group) => `${group.label} ${group.count} 项`).join("、")}${outcome.groups.length > 3 ? "等" : ""}`
        : "本次写入缺少可核验记录"}</span>
      <ChevronDown size={12} className={`shrink-0 ${open ? "rotate-180" : ""}`} aria-hidden />
    </Button>
    <div id={panelId} hidden={!open} className="space-y-2 px-2 py-2">
      <p>以下是执行当时保存的直接修改，按操作计数；后续编辑可能改变内容。生成、试听和整体完成情况需分别确认。</p>
      {outcome.entries.length > 0 && <ul className="space-y-1">
        {outcome.entries.map((entry) => <li key={`${entry.callId}:${entry.kind}:${entry.id}`}>
          <Button variant="ghost" size="sm" className="h-auto w-full justify-start px-1 py-1.5 text-left text-xs whitespace-normal" onClick={() => reveal({ runId: run.id, callId: entry.callId })}>
            <span className="min-w-0 break-words">{WRITE_OPERATION_LABELS[entry.operation]}{WRITE_KIND_LABELS[entry.kind]}{entry.label ? ` · ${entry.label}` : ""}<span className="ml-2 text-muted-foreground">查看记录</span></span>
          </Button>
        </li>)}
      </ul>}
      {outcome.omitted > 0 && <p>还有 {outcome.omitted} 项修改，请展开执行过程查看。</p>}
      {outcome.uncoveredCalls > 0 && <p>{outcome.uncoveredCalls} 次写入调用没有可核验的直接修改记录，未计入上述结果；不代表没有产生修改。</p>}
    </div>
  </div>;
}
