export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
}

export function modelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`;
}

export function chatCompletionsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

export type TestConnectionInput = {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
};

export type TestConnectionResult =
  | { ok: true; via: "models" | "chat"; modelCount?: number }
  | { ok: false; message: string };

function formatHttpError(status: number, body: string): string {
  const trimmed = body.trim().slice(0, 200);
  if (status === 401 || status === 403) {
    return trimmed ? `鉴权失败（${status}）：${trimmed}` : `鉴权失败（${status}）`;
  }
  return trimmed ? `请求失败（${status}）：${trimmed}` : `请求失败（${status}）`;
}

export type ListModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; message: string };

/**
 * List model ids from GET /v1/models (OpenAI-compatible).
 */
export async function listModels(
  input: { baseUrl: string; apiKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ListModelsResult> {
  const base = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  if (!base) return { ok: false, message: "请填写 Base URL" };
  if (!apiKey) return { ok: false, message: "请填写 API Key" };

  try {
    const res = await fetchImpl(modelsUrl(base), {
      method: "GET",
      headers: authHeaders(apiKey),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: formatHttpError(res.status, text) };
    }
    const data = (await res.json().catch(() => null)) as {
      data?: Array<{ id?: unknown }>;
    } | null;
    const models = Array.isArray(data?.data)
      ? data.data
          .map((row) => (typeof row?.id === "string" ? row.id.trim() : ""))
          .filter(Boolean)
          .filter((id, index, list) => list.indexOf(id) === index)
          .sort((left, right) => left.localeCompare(right))
      : [];
    return { ok: true, models };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "网络错误",
    };
  }
}

/**
 * Cheap connectivity check for OpenAI-compatible endpoints.
 * Prefers GET /models; falls back to a minimal chat/completions call.
 */
export async function testConnection(
  input: TestConnectionInput,
  fetchImpl: typeof fetch = fetch,
): Promise<TestConnectionResult> {
  const base = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  if (!base) return { ok: false, message: "请填写 Base URL" };
  if (!apiKey) return { ok: false, message: "请填写 API Key" };

  const headers = authHeaders(apiKey);

  try {
    const modelsRes = await fetchImpl(modelsUrl(base), { method: "GET", headers });
    if (modelsRes.ok) {
      const data = (await modelsRes.json().catch(() => null)) as { data?: unknown } | null;
      const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;
      return { ok: true, via: "models", modelCount };
    }
    if (modelsRes.status !== 404 && modelsRes.status !== 405) {
      const text = await modelsRes.text().catch(() => "");
      return { ok: false, message: formatHttpError(modelsRes.status, text) };
    }
  } catch (err) {
    // Fall through to chat probe — some proxies reject /models.
    if (!(err instanceof TypeError)) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "网络错误",
      };
    }
  }

  const model = input.defaultModel?.trim() || "gpt-4o-mini";
  try {
    const chatRes = await fetchImpl(chatCompletionsUrl(base), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    if (chatRes.ok) return { ok: true, via: "chat" };
    const text = await chatRes.text().catch(() => "");
    return { ok: false, message: formatHttpError(chatRes.status, text) };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "网络错误",
    };
  }
}
