export type ModelVendorGroup = {
  key: string;
  title: string;
  provider: string;
  models: string[];
};

const VENDOR_RULES: Array<{ key: string; title: string; provider: string; test: (id: string) => boolean }> = [
  // Do not start-anchor gpt-/gemini — catalog ids are often `cc-gpt-4o` / `cc-gemini-…`.
  // Keep o-series on a word boundary so `photo1` does not become OpenAI.
  {
    key: "openai",
    title: "OpenAI",
    provider: "openai",
    test: (id) => /gpt-|chatgpt|\bopenai\b|\bo[1-9]/.test(id),
  },
  { key: "anthropic", title: "Anthropic", provider: "anthropic", test: (id) => /claude/.test(id) },
  {
    key: "google",
    title: "Google",
    provider: "google",
    test: (id) => /gemini|gemma|\bgoogle\b/.test(id),
  },
  { key: "deepseek", title: "DeepSeek", provider: "deepseek", test: (id) => /deepseek/.test(id) },
  { key: "qwen", title: "Qwen", provider: "qwen", test: (id) => /qwen|qwq/.test(id) },
  { key: "moonshot", title: "Moonshot", provider: "moonshot", test: (id) => /kimi|moonshot/.test(id) },
  { key: "zhipu", title: "智谱", provider: "zhipu", test: (id) => /glm|chatglm|zhipu/.test(id) },
  { key: "baidu", title: "百度", provider: "baidu", test: (id) => /ernie|baidu/.test(id) },
  { key: "bytedance", title: "字节", provider: "bytedance", test: (id) => /doubao|seed-|bytedance/.test(id) },
  { key: "meta", title: "Meta", provider: "meta", test: (id) => /llama|meta-/.test(id) },
  { key: "mistral", title: "Mistral", provider: "mistral", test: (id) => /mistral|mixtral|pixtral/.test(id) },
  { key: "xai", title: "xAI", provider: "xai", test: (id) => /grok/.test(id) },
];

export function lookupVendor(modelId: string): { key: string; title: string; provider: string } {
  const id = modelId.toLowerCase();
  const slash = id.indexOf("/");
  const afterSlash = slash >= 0 ? id.slice(slash + 1) : id;
  const prefix = slash >= 0 ? id.slice(0, slash) : "";

  for (const rule of VENDOR_RULES) {
    if (rule.test(id) || rule.test(afterSlash) || (prefix && rule.test(prefix))) {
      return { key: rule.key, title: rule.title, provider: rule.provider };
    }
  }

  if (prefix) {
    return {
      key: prefix,
      title: prefix,
      provider: prefix,
    };
  }

  return { key: "other", title: "其他", provider: "openai" };
}

export function groupModelsByVendor(modelIds: string[]): ModelVendorGroup[] {
  const unique = [...new Set(modelIds.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, ModelVendorGroup>();
  for (const id of unique) {
    const vendor = lookupVendor(id);
    const existing = map.get(vendor.key);
    if (existing) {
      existing.models.push(id);
    } else {
      map.set(vendor.key, {
        key: vendor.key,
        title: vendor.title,
        provider: vendor.provider,
        models: [id],
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === "other") return 1;
    if (b.key === "other") return -1;
    return a.title.localeCompare(b.title, "zh");
  });
}

export function modelDisplayName(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  return slash >= 0 ? modelId.slice(slash + 1) : modelId;
}

export type ModelHints = {
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
};

/** Best-effort tags from the model id until connectors expose real cards. */
export function inferModelHints(modelId: string): ModelHints {
  const id = modelId.toLowerCase();
  return {
    vision: /vision|\bvl\b|-vl-|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|qwen3-vl|glm-4v/.test(id),
    tools: !/embed|tts|whisper|dall-e|imagen|image-/.test(id),
    reasoning: /o1|o3|o4|r1|think|reason|gpt-5|claude-4|glm-5|deepseek-r|\bpro\b/.test(id),
  };
}
