/** Global local-only secret. Never project data or model input. */
export interface SearchConnection { id: 'tavily'; provider: 'tavily'; apiKey: string; enabled: boolean; revision: string; updatedAt: string }
export interface SearchConnectionState { configured: boolean; enabled: boolean; revision?: string }
export interface WebSource { id: string; title: string; url: string; snippet: string; publishedAt?: string }
export type WebFailureCode = 'not_configured' | 'configuration_changed' | 'authentication' | 'rate_limit' | 'quota' | 'http' | 'timeout' | 'cancelled' | 'transport' | 'invalid_response' | 'response_too_large' | 'extraction_failed';
export interface WebFailure { ok: false; code: WebFailureCode; message: string; serviceMayHaveRun: boolean; retrievedAt: string }
export interface WebSearchResult { ok: true; kind: 'search'; query: string; retrievedAt: string; sources: WebSource[]; requestId?: string; omittedSources: number }
export interface WebReadResult { ok: true; kind: 'read'; requestedUrl: string; url: string; retrievedAt: string; text: string; availableLength: number; truncated: boolean; coverage: 'provider_extraction'; requestId?: string }
export type WebResult = WebFailure | WebSearchResult | WebReadResult;

/** Validate user and provider links equally; URL canonicalization catches encoded IPv4. */
export function publicWebUrl(raw: string): string | undefined {
  if (!raw || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') && !host.startsWith('[') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return undefined;
    if (host.startsWith('[')) {
      // Only global unicast IPv6; excludes loopback, mapped IPv4, local and link-local.
      if (!/^\[[23][0-9a-f]{3}:/.test(host)) return undefined;
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 198 && [18, 19].includes(b)) return undefined;
    }
    return url.href;
  } catch { return undefined; }
}

/** One bounded decoder for persisted source presentation. Plain text only. */
export function webResultSources(name: string, result?: string): { sources: WebSource[]; note: string } | undefined {
  if (!['web_search', 'web_read'].includes(name) || !result) return undefined;
  try {
    const value = JSON.parse(result) as { ok?: boolean; message?: string; sources?: WebSource[]; url?: string; retrievedAt?: string; truncated?: boolean };
    if (!value.ok) return { sources: [], note: typeof value.message === 'string' ? value.message.slice(0, 1000) : '联网调研失败' };
    const sources: WebSource[] = [];
    if (name === 'web_search' && Array.isArray(value.sources)) {
      for (const item of value.sources.slice(0, 10)) {
        if (typeof item.url !== 'string' || !publicWebUrl(item.url) || typeof item.title !== 'string') continue;
        sources.push({ id: String(item.id).slice(0, 80), title: item.title.slice(0, 240), url: publicWebUrl(item.url)!, snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 1500) : '', publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt.slice(0, 100) : undefined });
      }
    } else if (name === 'web_read' && typeof value.url === 'string' && publicWebUrl(value.url)) sources.push({ id: 'page', title: '已读取网页', url: publicWebUrl(value.url)!, snippet: '' });
    return { sources, note: `${typeof value.retrievedAt === 'string' ? value.retrievedAt.slice(0, 40) : ''} · ${name === 'web_search' ? sources.length ? '搜索摘要，未必已读取原文' : '未找到可用来源' : value.truncated ? '提取内容已截断；不保证完整网页' : '服务提取内容，不保证完整网页'}` };
  } catch { return undefined; }
}
