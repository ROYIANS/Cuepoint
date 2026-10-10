import {expect} from "vitest";

interface FixtureUsage {inputTokens: number; outputTokens: number; totalTokens: number}

/** A real separate provider response for the approved zero-tool terminal request.
 * Ordinary model rounds (including the finishing checkpoint) still reach the
 * original fixture, so its tool/protocol/replay assertions remain active.
 */
export function withFinalReviewFixture(fetcher: typeof fetch, usage?: FixtureUsage): typeof fetch {
    let reviews = 0;
    return async (url, init) => {
        const body = JSON.parse(String(init?.body));
        const messages = (body.messages ?? body.input) as Array<{role?: string; content?: unknown}> | undefined;
        const first = messages?.[0];
        if (first?.role !== "system" || typeof first.content !== "string" || !first.content.startsWith("你只读检查原回复中的已完成工作声明")) return fetcher(url, init);
        expect(++reviews).toBe(1);
        expect(body.tools ?? []).toEqual([]);
        expect(messages).toHaveLength(2);
        expect(messages?.[1].role).toBe("user");
        const input = JSON.parse(String(messages?.[1].content));
        expect(typeof input.originalText).toBe("string");
        expect(input.evidence).toBeInstanceOf(Array);
        expect(JSON.stringify(messages)).not.toMatch(/data:image|encrypted_content|function_call_output|tool_call_id/);
        const text = JSON.stringify({claims: []});
        return "input" in body ? Response.json({status: "completed", output: [{type: "message", role: "assistant", content: [{type: "output_text", text}]}],
            ...(usage ? {usage: {input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, total_tokens: usage.totalTokens}} : {})})
            : Response.json({choices: [{message: {content: text}, finish_reason: "stop"}],
                ...(usage ? {usage: {prompt_tokens: usage.inputTokens, completion_tokens: usage.outputTokens, total_tokens: usage.totalTokens}} : {})});
    };
}
