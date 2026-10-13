import {useId, useMemo, useState} from "react";
import {ChevronDown} from "@/components/ui/icons";
import type {AgentRun, AgentToolCall} from "@/domain/agent";
import {Button} from "@/components/ui/button";
import {describeRunWrites, WRITE_KIND_LABELS, WRITE_OPERATION_LABELS} from "@/lib/agent/runWriteOutcomes";
import {useAgentActivityNavigation} from "./AgentActivityNavigation";

export function AgentWriteOutcomes({run, calls}: { run: AgentRun; calls: AgentToolCall[] }) {
    const outcome = useMemo(() => describeRunWrites(run, calls), [run, calls]);
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const {reveal} = useAgentActivityNavigation();
    if (!outcome.total) return null;
    return <div className="min-w-0 py-1 text-xs text-muted-foreground">
        <Button variant="ghost" size="sm"
                className="h-auto max-w-full hover:bg-transparent dark:hover:bg-transparent hover:text-foreground justify-start gap-2 px-2 py-1.5 text-left text-xs whitespace-normal"
                aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <span className="min-w-0 break-words">{`本次已保存：${outcome.groups.slice(0, 3).map((group) => `${group.label} ${group.count} 项`).join("、")}${outcome.groups.length > 3 ? "等" : ""}`}</span>
            <ChevronDown size={12} className={`shrink-0 ${open ? "rotate-180" : ""}`} aria-hidden/>
        </Button>
        <div id={panelId} hidden={!open} className="space-y-2 px-2 py-2">
            {outcome.entries.length > 0 && <ul className="space-y-1">
                {outcome.entries.map((entry) => <li key={`${entry.callId}:${entry.kind}:${entry.id}`}>
                    <Button variant="ghost" size="sm"
                            className="h-auto w-full hover:bg-transparent dark:hover:bg-transparent hover:text-foreground justify-start px-1 py-1.5 text-left text-xs whitespace-normal"
                            onClick={() => reveal({runId: run.id, callId: entry.callId})}>
                        <span
                            className="min-w-0 break-words">{WRITE_OPERATION_LABELS[entry.operation]}{WRITE_KIND_LABELS[entry.kind]}{entry.label ? ` · ${entry.label}` : ""}<span
                            className="ml-2 text-muted-foreground">查看记录</span></span>
                    </Button>
                </li>)}
            </ul>}
            {outcome.omitted > 0 && <p>还有 {outcome.omitted} 项修改，请展开执行过程查看。</p>}
        </div>
    </div>;
}
