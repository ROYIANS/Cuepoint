import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { getSearchConnectionState, removeSearchConnection, saveSearchConnection } from '@/db/searchConnections';
import { getGeneralAgentConfig, updateGeneralAgentConfig } from '@/db/agentSettings';
import { executeWebRequest, testSearchConnection } from '@/lib/ai/tavily';
import { publicWebUrl, webResultSources } from '@/domain/search';
import { validateToolCall } from '@/lib/agent/tools';

const secret = 'tvly-test-secret';
async function config() { await saveSearchConnection({ apiKey: secret, enabled: true }); return (await getSearchConnectionState()).revision; }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('local search configuration', () => {
  it('saves without HTTP, preserves skill choices, honors later disable and removes the secret', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await updateGeneralAgentConfig({ enabledSkillIds: ['planning'] });
    await config();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(['planning', 'web-research']);
    expect(JSON.stringify(await getSearchConnectionState())).not.toContain(secret);
    await updateGeneralAgentConfig({ enabledSkillIds: ['planning'] });
    db.close(); await db.open();
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(['planning']);
    await saveSearchConnection({ enabled: false });
    expect((await getGeneralAgentConfig()).enabledSkillIds).toEqual(['planning']);
    const previous = (await getSearchConnectionState()).revision;
    await removeSearchConnection(); await config();
    expect((await getSearchConnectionState()).revision).not.toBe(previous);
    await removeSearchConnection(); expect(await db.searchConnections.count()).toBe(0);
  });
  it('tests only GET usage, never searches, and never returns provider error or secret text', async () => {
    await config();
    const fetcher = vi.fn(async () => Response.json({ key: secret, total_usage: 5 }));
    expect(await testSearchConnection(undefined, { fetchImpl: fetcher })).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual(['https://api.tavily.com/usage', expect.objectContaining({ method: 'GET', credentials: 'omit', redirect: 'error' })]);
    const bad = await testSearchConnection(secret, { fetchImpl: async () => Response.json({ message: secret }, { status: 401 }) });
    expect(bad.ok).toBe(false); expect(JSON.stringify(bad)).not.toContain(secret);
  });
});

describe('bounded single-request Tavily adapter', () => {
  it('sends basic search flags and filters unsafe or overlong URLs without truncating targets', async () => {
    const revision = await config();
    const fetcher = vi.fn(async () => Response.json({ request_id: 'request-1', results: [
      { title: 'Source', url: 'https://example.com/a', content: 'text'.repeat(600), published_date: '2026-09-01' },
      { title: 'Private', url: 'http://127.1/a', content: 'bad' },
      { title: 'Too long', url: 'https://example.com/' + 'x'.repeat(2100), content: 'bad' },
      { title: secret, url: 'https://example.org/', content: secret },
    ] }));
    const result = await executeWebRequest('search', { query: 'rain', maxResults: 5, timeRange: 'month' }, revision, { fetchImpl: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ query: 'rain', max_results: 5, time_range: 'month', search_depth: 'basic', include_answer: false, include_raw_content: false, include_images: false, auto_parameters: false });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result).toMatchObject({ ok: true, kind: 'search', omittedSources: 2, sources: [{ url: 'https://example.com/a', publishedAt: '2026-09-01' }, { url: 'https://example.org/' }] });
    if (result.ok && result.kind === 'search') expect(result.sources[0].snippet).toHaveLength(1500);
  });
  it('distinguishes empty successful search and never infers publication time', async () => {
    const revision = await config();
    const result = await executeWebRequest('search', { query: 'nothing' }, revision, { fetchImpl: async () => Response.json({ results: [] }) });
    expect(result).toMatchObject({ ok: true, sources: [] });
    expect(webResultSources('web_search', JSON.stringify(result))?.note).toContain('未找到');
  });
  it.each([401, 429, 432, 500])('normalizes HTTP %s without exposing vendor bodies or retrying', async (status) => {
    const revision = await config();
    const fetcher = vi.fn(async () => Response.json({ error: secret }, { status }));
    const result = await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: fetcher });
    expect(result).toMatchObject({ ok: false, serviceMayHaveRun: true });
    expect(JSON.stringify(result)).not.toContain(secret); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fails before HTTP for missing, disabled or changed configuration', async () => {
    const fetcher = vi.fn();
    expect(await executeWebRequest('search', { query: 'q' }, undefined, { fetchImpl: fetcher })).toMatchObject({ code: 'not_configured', serviceMayHaveRun: false });
    const revision = await config(); await saveSearchConnection({ apiKey: 'new-key', enabled: true });
    expect(await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: fetcher })).toMatchObject({ code: 'configuration_changed' });
    await saveSearchConnection({ enabled: false });
    expect(await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: fetcher })).toMatchObject({ code: 'not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('times out once and truthfully retains possible server processing', async () => {
    const revision = await config();
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error(secret)))));
    const result = await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: fetcher, timeoutMs: 5 });
    expect(result).toMatchObject({ ok: false, code: 'timeout', serviceMayHaveRun: true }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('stops a request without claiming server cancellation and does not retry', async () => {
    const revision = await config(), controller = new AbortController();
    const fetcher = vi.fn(async () => { controller.abort(); throw new Error(secret); });
    const result = await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: fetcher, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, code: 'cancelled', serviceMayHaveRun: true }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed bodies before parsing and rejects invalid JSON', async () => {
    const revision = await config();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); }, cancel }));
    expect(await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: async () => response })).toMatchObject({ code: 'response_too_large' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(await executeWebRequest('search', { query: 'q' }, revision, { fetchImpl: async () => new Response('not-json') })).toMatchObject({ code: 'invalid_response' });
  });
  it('extracts one page with truthful coverage and escaped serialized bounds', async () => {
    const revision = await config();
    const fetcher = vi.fn(async () => Response.json({ results: [{ url: 'https://example.com/', raw_content: '\u0000'.repeat(30000) }] }));
    const result = await executeWebRequest('read', { url: 'https://example.com/' }, revision, { fetchImpl: fetcher });
    expect(result).toMatchObject({ ok: true, kind: 'read', availableLength: 30000, truncated: true, coverage: 'provider_extraction' });
    expect(JSON.stringify(result).length).toBeLessThan(65536);
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ urls: ['https://example.com/'], extract_depth: 'basic', format: 'markdown', include_images: false });
  });
  it('returns explicit extraction failure and never invents a shortened returned URL', async () => {
    const revision = await config();
    for (const data of [{ results: [], failed_results: [{ error: secret }] }, { results: [{ url: 'https://example.com/' + 'x'.repeat(2100), raw_content: 'x' }] }]) {
      expect(await executeWebRequest('read', { url: 'https://example.com/' }, revision, { fetchImpl: async () => Response.json(data) })).toMatchObject({ code: 'extraction_failed' });
    }
  });
  it('keeps worst-case search serialization under 32K', async () => {
    const revision = await config();
    const result = await executeWebRequest('search', { query: '\u0000'.repeat(500), maxResults: 10 }, revision, { fetchImpl: async () => Response.json({ results: Array.from({ length: 10 }, () => ({ title: '\u0000'.repeat(240), url: 'https://example.com/' + 'a'.repeat(1900), content: '\u0000'.repeat(1500) })) }) });
    expect(JSON.stringify(result).length).toBeLessThan(32000);
  });
});

describe('strict web arguments and safe persisted links', () => {
  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'https://u:p@example.com', 'http://localhost', 'http://127.1', 'http://0x7f000001', 'http://192.168.1.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]'])('rejects unsafe URL %s', (url) => {
    expect(publicWebUrl(url)).toBeUndefined();
    expect(() => validateToolCall('web_read', JSON.stringify({ url }), ['web_read'])).toThrow();
    expect(webResultSources('web_search', JSON.stringify({ ok: true, sources: [{ id: '1', title: 'bad', url }] }))?.sources).toEqual([]);
  });
  it('rejects extra fields and numeric limits, accepts a full 2048-character public URL', () => {
    for (const args of [{ query: 'q', apiKey: secret }, { query: 'q', maxResults: 11 }, { query: '' }]) expect(() => validateToolCall('web_search', JSON.stringify(args), ['web_search'])).toThrow();
    const url = 'https://example.com/' + 'a'.repeat(2028);
    expect(url).toHaveLength(2048);
    expect(validateToolCall('web_read', JSON.stringify({ url }), ['web_read']).args).toEqual({ url });
  });
});
