/** Hosts retain source annotations and summary prompts; core preserves complete turns and bounded progress. */
export interface ContextSource {id:string;role:string;content:string}
export interface SummaryRecord<Source> {id:string;status:string;coverage:Source[];content:string;beforeTokens:number}
interface ContextBudget {needsCompression:boolean;overBudget:boolean;outputReserve:number}
export interface CompactionHost<Run,Source extends ContextSource,Record extends SummaryRecord<Source>,Input,Usage> {
    read:()=>Promise<Run>;
    assertSettled:(run:Run)=>Promise<void>;
    context:(run:Run)=>{history:Source[];summaryId?:string;autoCompress:boolean}|undefined;
    budget:(run:Run,hasSummary?:boolean)=>ContextBudget;
    readSummary:(id:string)=>Promise<Record|undefined>;
    sameSource:(left:Source,right:Source)=>boolean;
    input:(previous:Record|undefined,selected:Source[])=>Input;
    fits:(run:Run,input:Input)=>boolean;
    create:(run:Run,previous:Record|undefined,selected:Source[],input:Input)=>Record;
    begin:(run:Run,record:Record)=>Promise<void>;
    request:(run:Run,input:Input,outputReserve:number,signal:AbortSignal)=>Promise<{content:string;hasToolCalls:boolean;usage?:Usage}>;
    tokens:(content:string)=>number;
    activate:(run:Run,record:Record,content:string,usage:Usage|undefined,signal:AbortSignal)=>Promise<Run>;
    /** Bounded, model-free reduction of already-seen current-turn results; return the same run when nothing changed. */
    prune?:(run:Run,signal:AbortSignal)=>Promise<Run>;
    fail:(record:Record,cause:unknown,signal:AbortSignal)=>Promise<string>;
}

function groupContextHistory<Source extends {role:string}>(history:readonly Source[]):Source[][] {
    const groups:Source[][]=[];
    for (const message of history) {
        if (message.role === 'user' || !groups.length) groups.push([]);
        groups[groups.length-1].push(message);
    }
    return groups;
}

export function selectHistoryByCount<Source extends {role:string}>(history:readonly Source[],count:number):Source[] {
    const selected:Source[][]=[];
    let remaining=count;
    for (const group of groupContextHistory(history).reverse()) {
        if (group.length > remaining) break;
        selected.unshift(group);remaining-=group.length;
    }
    return selected.flat();
}
export function isContextSourcePrefix<Source extends ContextSource>(prefix:readonly Source[],history:readonly Source[],sameMetadata:(left:Source,right:Source)=>boolean):boolean {
    return prefix.length>0 && prefix.length<=history.length && prefix.every((source,i)=>source.id === history[i].id && source.role === history[i].role && source.content === history[i].content && sameMetadata(source,history[i]));
}

export interface CompactionOptions {
    /** A confirmed provider overflow: reduce once regardless of thresholds, never loop. */
    force?:boolean;
}

/**
 * A summary never slices a turn, includes the current draft, or runs an unbounded extra request.
 * One failed summary request is retried once; a second failure falls back to the uncompressed request
 * only while it is still inside the hard input budget, otherwise the failure is reported.
 */
export async function compactContext<Run,Source extends ContextSource,Record extends SummaryRecord<Source>,Input,Usage>(host:CompactionHost<Run,Source,Record,Input,Usage>,signal:AbortSignal,options:CompactionOptions={}):Promise<Run> {
    let run=await host.read();
    await host.assertSettled(run);
    if (!host.context(run)) return run;
    let pruned=false;
    for (let pass=0;pass<8;pass++) {
        signal.throwIfAborted();
        if (options.force && pass>0) return run;
        const context=host.context(run)!;
        const measured=host.budget(run);
        const budget=options.force ? {...measured,needsCompression:true,overBudget:true} : measured;
        if (!context.autoCompress || !budget.needsCompression) {
            if (budget.overBudget) throw new Error('上下文超过安全输入预算。请开启自动压缩、减少历史消息或缩短当前输入后重新发送。');
            return run;
        }
        if (host.prune && !pruned) {
            pruned=true;
            const next=await host.prune(run,signal);
            if (next !== run) {run=next;continue;}
        }
        const previous=context.summaryId ? await host.readSummary(context.summaryId) : undefined;
        if (context.summaryId && (!previous || previous.status !== 'completed' || !isContextSourcePrefix(previous.coverage,context.history,host.sameSource))) throw new Error('历史摘要已失效，请发送新消息重新选择上下文');
        const groups=groupContextHistory(context.history.slice(previous?.coverage.length ?? 0));
        const candidates=budget.overBudget ? groups : groups.slice(0,-1);
        const selected:Source[]=[];
        for (const group of candidates) {
            if (!host.fits(run,host.input(previous,[...selected,...group]))) break;
            selected.push(...group);
        }
        if (!selected.length) {
            if (measured.overBudget) throw new Error('当前输入、完整对话轮次或本轮工具结果过大，无法安全压缩。请缩短输入、减少历史范围，或结束本次执行后开启新对话。');
            return run;
        }
        const input=host.input(previous,selected);
        let accepted:{record:Record;content:string;usage:Usage|undefined}|undefined;
        let failure='';
        for (let attempt=0;attempt<2 && !accepted;attempt++) {
            const record=host.create(run,previous,selected,input);
            await host.begin(run,record);
            try {
                const result=await host.request(run,input,budget.outputReserve,signal);
                signal.throwIfAborted();
                const content=result.content.trim();
                if (!content) throw new Error('摘要为空，原始对话已保留。');
                if (result.hasToolCalls || host.tokens(content)+32 >= record.beforeTokens) throw new Error('摘要未能有效缩短上下文，原始对话已保留。请调整历史范围后重新发送。');
                accepted={record,content,usage:result.usage};
            } catch (cause) {
                failure=await host.fail(record,cause,signal);
                // eslint-disable-next-line preserve-caught-error -- Only the host's redacted message may cross this boundary.
                if (signal.aborted) throw new Error(failure);
            }
        }
        if (!accepted) {
            if (measured.overBudget || options.force) throw new Error(failure);
            return run;
        }
        try {
            run=await host.activate(run,accepted.record,accepted.content,accepted.usage,signal);
        } catch (cause) {
            // eslint-disable-next-line preserve-caught-error -- Only the host's redacted message may cross this boundary.
            throw new Error(await host.fail(accepted.record,cause,signal));
        }
    }
    if (!host.budget(run,true).needsCompression) return run;
    throw new Error('已完成本轮 8 次历史整理，已保存摘要。请手动继续或重新生成，不会自动追加请求。');
}

/** Replace an exact base while preserving every opaque continuation item after it. */
export function replaceContinuationBase<Item>(current:readonly Item[],previous:readonly Item[],next:readonly Item[]):Item[] {
    if (JSON.stringify(current.slice(0,previous.length)) !== JSON.stringify(previous)) throw new Error('历史与执行信封不一致，摘要未启用');
    return [...next,...current.slice(previous.length)];
}
