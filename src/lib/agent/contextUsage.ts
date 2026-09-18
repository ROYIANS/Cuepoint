import type { AgentRequestMessage, AgentToolSchema } from "@/domain/agent";
import type { ChatMessage } from "@/domain/types";

/** Shared with beginAgentRun so the preview includes exactly the eligible history. */
export function buildAgentRequestMessages(instructions: string, skillInstructions: string, history: readonly ChatMessage[], draft: string): AgentRequestMessage[] {
  return [
    { role: "system", content: [instructions, skillInstructions].filter(Boolean).join("\n") },
    ...history.filter((message) => !message.status || message.status === "complete").map((message) => ({ role: message.role, content: message.content })),
    ...(draft.trim() ? [{ role: "user" as const, content: draft.trim() }] : []),
  ];
}

/** Lightweight character heuristic, NOT a provider tokenizer or billing measurement. */
export function estimateTokens(text: string): number {
  let weight = 0;
  for (const char of text) weight += char.codePointAt(0)! <= 0x7f ? 0.25 : 1.5;
  return Math.ceil(weight);
}

export type ContextUsage = {
  categories: Array<{ id: string; label: string; tokens: number; color: string }>;
  total: number;
};

export function estimateContextUsage(input: {
  instructions: string;
  skillInstructions: string;
  messages: readonly AgentRequestMessage[];
  tools: readonly AgentToolSchema[];
}): ContextUsage {
  const categories = [
    { id: "assistant", label: "助手指令", tokens: 0, color: "#dc62b6" },
    { id: "skills", label: "技能与工具", tokens: estimateTokens(input.skillInstructions) + (input.tools.length ? estimateTokens(JSON.stringify(input.tools)) : 0), color: "#5899f5" },
    { id: "messages", label: "会话消息", tokens: 0, color: "#edb44d" },
    { id: "results", label: "工具结果", tokens: 0, color: "#a2c96a" },
  ];
  const system = [input.instructions, input.skillInstructions].filter(Boolean).join("\n");
  input.messages.forEach((message, index) => {
    // Split only the exact initial system envelope; never count the skill prompt twice.
    if (index === 0 && message.role === "system" && message.content === system) {
      categories[0].tokens += estimateTokens(input.instructions) + 4;
      return;
    }
    const category = message.role === "tool" ? categories[3] : message.role === "system" ? categories[0] : categories[2];
    category.tokens += estimateTokens(message.content) + 4;
    if (message.role === "assistant" && message.tool_calls) category.tokens += estimateTokens(JSON.stringify(message.tool_calls));
    if (message.role === "tool") category.tokens += estimateTokens(message.tool_call_id);
  });
  return { categories, total: categories.reduce((sum, category) => sum + category.tokens, 0) };
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toLocaleString("en-US");
  if (tokens < 1_000_000) return `${Number((tokens / 1000).toFixed(1))}K`;
  return `${Number((tokens / 1_000_000).toFixed(2))}M`;
}
