export interface ContextPolicy {
    autoCompress:boolean;
    limitHistory:boolean;
    historyMessageCount:number;
    customContextTokens?:number;
}
export const DEFAULT_CONTEXT_POLICY:Readonly<ContextPolicy>={autoCompress:true,limitHistory:false,historyMessageCount:20};
export function normalizeContextPolicy(value?:Partial<ContextPolicy>):ContextPolicy {
    const integer=(n:unknown,min:number,max:number)=>typeof n === 'number' && Number.isSafeInteger(n) && n>=min && n<=max;
    return {autoCompress:typeof value?.autoCompress === 'boolean' ? value.autoCompress : DEFAULT_CONTEXT_POLICY.autoCompress,limitHistory:typeof value?.limitHistory === 'boolean' ? value.limitHistory : DEFAULT_CONTEXT_POLICY.limitHistory,historyMessageCount:integer(value?.historyMessageCount,0,10000) ? value!.historyMessageCount! : DEFAULT_CONTEXT_POLICY.historyMessageCount,...(integer(value?.customContextTokens,2048,10000000) ? {customContextTokens:value!.customContextTokens} : {})};
}

/** A character heuristic, never a provider tokenizer or billing measurement. */
export function estimateTokens(text:string):number {
    let weight=0;
    for (const char of text) weight+=char.codePointAt(0)! <= 0x7f ? 0.25 : 1.5;
    return Math.ceil(weight);
}

/** Product materialization costs are explicit input; reserve and threshold mechanisms are shared. */
export function budgetEnvelope(messages:readonly unknown[],tools:readonly unknown[],capacity?:number,hasSummary=false,extraTokens=0) {
    const estimatedTokens=estimateTokens(JSON.stringify(messages))+(tools.length ? estimateTokens(JSON.stringify(tools)) : 0)+extraTokens;
    const adjustedTokens=Math.ceil(estimatedTokens*1.25);
    const outputReserve=capacity ? Math.min(8192,Math.max(256,Math.floor(capacity*0.15))) : 0;
    const inputBudget=capacity ? Math.max(0,capacity-outputReserve-Math.ceil(capacity*0.05)) : undefined;
    const threshold=capacity && inputBudget ? Math.min(inputBudget,Math.floor(capacity*(hasSummary ? 0.65 : 0.5))) : undefined;
    return {estimatedTokens,adjustedTokens,outputReserve,inputBudget,threshold,needsCompression:threshold !== undefined && adjustedTokens>=threshold,overBudget:inputBudget !== undefined && adjustedTokens>inputBudget};
}
