import type {AgentTokenUsage, ModelPricing} from "../../../domain/agent";

export interface RunCostEstimate {
    /** USD; undefined when usage or a required price is unknown. */
    amount?: number;
    /** False whenever any contributing figure was unknown. Unknown is never priced as 0. */
    complete: boolean;
}

type Rates = Pick<ModelPricing, "input" | "output" | "cacheRead" | "cacheWrite">;

/**
 * Prices cached input at the cache-read rate and the rest at the input rate.
 * `cachedInputTokens` is a subset of `inputTokens` (see the stream parsers). Usage has no
 * cache-write count, so `cacheWrite` is not applied. Rates are USD per million tokens.
 */
export function estimateRunCost(usage: AgentTokenUsage | undefined, pricing: Rates | undefined): RunCostEstimate {
    if (!pricing || usage?.inputTokens === undefined || usage.outputTokens === undefined) return {complete: false};
    const cached = usage.cachedInputTokens ?? 0;
    const uncached = Math.max(0, usage.inputTokens - cached);
    const lines: Array<[number, number | undefined]> = [
        [uncached, pricing.input],
        [cached, pricing.cacheRead],
        [usage.outputTokens, pricing.output],
    ];
    let amount = 0;
    for (const [tokens, rate] of lines) {
        if (tokens === 0) continue;
        if (rate === undefined) return {complete: false};
        amount += tokens * rate / 1_000_000;
    }
    return {amount, complete: true};
}
