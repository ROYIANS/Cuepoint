import {assert} from './acceptanceEvidence';

export const TAVILY_PROBE_KEY = 'synthetic-tavily-probe-only';

/** Test-only exact routing. Production's fixed Tavily endpoint is not changed. */
export function fixtureTavilyFetch(endpoint: string, transport: typeof fetch): typeof fetch {
    assert(/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(endpoint), '探针需使用明确本机端点');
    const origin = new URL(endpoint).origin;
    return (input, init) => {
        assert(typeof input === 'string', '探针仅接受适配器固定字符串 URL');
        const url = new URL(input);
        const usage = url.pathname === '/usage';
        assert(url.origin === 'https://api.tavily.com' && !url.username && !url.password && !url.search && !url.hash &&
            ['/usage', '/search', '/extract'].includes(url.pathname), '拒绝探针范围外地址');
        const headers = new Headers(init?.headers);
        assert(headers.get('authorization') === `Bearer ${TAVILY_PROBE_KEY}` && !headers.has('cookie') &&
            init?.method === (usage ? 'GET' : 'POST') && init.credentials === 'omit' && init.redirect === 'error' &&
            (usage ? init.body == null : typeof init.body === 'string'), '探针鉴权／方法／正文策略错误');
        return transport(`${origin}${url.pathname}`, init);
    };
}

