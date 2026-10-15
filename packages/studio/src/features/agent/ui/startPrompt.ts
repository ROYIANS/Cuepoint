const START_PROMPT = "请根据当前任务目标和执行清单开始推进；如需补充关键信息，请先说明。";

/** The start hint appends to a typed draft instead of replacing it, and never repeats itself. */
export function appendStartPrompt(draft: string): string {
    const existing = draft.trimEnd();
    if (!existing) return START_PROMPT;
    return existing.includes(START_PROMPT) ? draft : `${existing}\n\n${START_PROMPT}`;
}
