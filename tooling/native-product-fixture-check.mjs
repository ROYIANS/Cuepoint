import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {startNativeProductFixture} from './native-product-fixture.mjs';

const fixture = await startNativeProductFixture();
let parserServer;
const passed = [];
const check = async (name, action) => {await action(); passed.push(name);};
const post = (path, body, headers = {}) => fetch(`${fixture.origin}${path}`, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
const calls = text => text.split(/\r?\n/).filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6))).flatMap(entry => entry.choices?.[0]?.delta?.tool_calls ?? []);
const command = (name, args) => ({role: 'user', content: `[fixture:tool] ${JSON.stringify({name, arguments: args})}`});
try {
    // Load the unchanged product parser with its actual TypeScript/alias graph.
    // This server has no listener; the fixture still uses its own ephemeral port.
    parserServer = await createServer({configFile: false, root: fileURLToPath(new URL('../', import.meta.url)),
        resolve: {alias: {'@': fileURLToPath(new URL('../packages/studio/src', import.meta.url))}},
        server: {middlewareMode: true, hmr: false, watch: null}, optimizeDeps: {noDiscovery: true}});
    const {streamResponses, toResponseInput} = await parserServer.ssrLoadModule('/packages/studio/src/features/agent/providers/responsesStream.ts');
    const {uploadApimartImage, submitApimartImageGeneration, getApimartTask} = await parserServer.ssrLoadModule('/packages/studio/src/features/video/providers/apimart.ts');
    const responsesInput = (messages, tools = []) => ({baseUrl: `${fixture.origin}/v1`, apiKey: 'synthetic-local-only',
        connectorDefinitionId: 'openai-compatible', model: 'gpt-5.6-luna', messages, tools});
    await check('no CORS/model directory', async () => {
        const response = await fetch(`${fixture.origin}/v1/models`);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        assert.ok((await response.json()).data.some(model => model.id === 'fixture-chat'));
    });
    await check('real bytes/hash', async () => {
        const response = await fetch(`${fixture.origin}/media/audio`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const source = await readFile(new URL('../apps/desktop/fixtures/media/tone.wav', import.meta.url));
        const hash = value => createHash('sha256').update(value).digest('hex');
        assert.equal(hash(bytes), hash(source));
    });
    await check('multipart upload/reference image submit/poll pass the actual APIMart adapter', async () => {
        const image = await readFile(new URL('../apps/desktop/fixtures/media/image.png', import.meta.url));
        const credentials = {baseUrl: `${fixture.origin}/v1`, apiKey: 'synthetic-local-only'};
        const result = await uploadApimartImage(credentials, new Blob([image], {type: 'image/png'}), {filename: 'image.png', fetchImpl: fetch});
        assert.equal(result.ok, true, result.message);
        assert.equal(result.image.url, `${fixture.origin}/media/image`);
        assert.equal(result.image.filename, 'image.png');
        assert.equal(result.image.contentType, 'image/png');
        assert.equal(result.image.bytes, image.length);
        assert.equal(result.image.expiresAt, result.image.createdAt + 72 * 60 * 60);
        const receipt = fixture.events.findLast(entry => entry.type === 'multipart-file');
        assert.equal(receipt.byteLength, image.length);
        assert.equal(receipt.sha256, createHash('sha256').update(image).digest('hex'));
        assert.equal(receipt.filename, 'image.png');
        const submitted = await submitApimartImageGeneration(credentials, {model: 'gpt-image-2.5-flare', prompt: '合成参考图验收', image_urls: [result.image.url]}, {fetchImpl: fetch});
        assert.equal(submitted.ok, true, submitted.message);
        assert.equal(submitted.tasks.length, 1);
        const taskId = submitted.tasks[0].id;
        const queried = await getApimartTask(credentials, taskId, {fetchImpl: fetch});
        assert.equal(queried.ok, true, queried.message);
        assert.equal(queried.task.status, 'completed');
        assert.equal(queried.task.images[0].urls[0], `${fixture.origin}/media/image`);
        const output = Buffer.from(await (await fetch(queried.task.images[0].urls[0])).arrayBuffer());
        assert.equal(createHash('sha256').update(output).digest('hex'), createHash('sha256').update(image).digest('hex'));
        const submittedRequests = fixture.events.filter(entry => entry.type === 'request' && entry.path === '/v1/images/generations');
        assert.equal(submittedRequests.length, 1);
        const download = fixture.events.findLast(entry => entry.type === 'request' && entry.path === '/media/image');
        assert.equal(download.authorizationPresent, false);
        assert.equal(download.cookiePresent, false);
    });
    await check('nested APIMart upload data remains rejected by the actual adapter', async () => {
        const image = await readFile(new URL('../apps/desktop/fixtures/media/image.png', import.meta.url));
        let requests = 0;
        const result = await uploadApimartImage({baseUrl: `${fixture.origin}/v1`, apiKey: 'synthetic-local-only'}, new Blob([image], {type: 'image/png'}), {
            fetchImpl: async (url, init) => {
                requests++;
                const response = await fetch(url, init);
                // Recreate the old fixture's invalid upload envelope. The product
                // adapter must continue rejecting it instead of accepting aliases.
                return Response.json({code: 200, data: await response.json()});
            }
        });
        assert.equal(requests, 1);
        assert.deepEqual(result, {ok: false, kind: 'protocol', message: 'APIMart 返回的数据格式不符合接口约定'});
    });
    await check('multipart rejects missing real file', async () => {
        const response = await fetch(`${fixture.origin}/v1/uploads/images`, {method: 'POST', headers: {'Content-Type': 'multipart/form-data'}, body: 'name="file"'});
        assert.equal(response.status, 400);
    });
    await check('submit/poll', async () => {
        const response = await fetch(`${fixture.origin}/v1/images/generations`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: 'gpt-image-2.5'})});
        const id = (await response.json()).data[0].task_id;
        const task = await (await fetch(`${fixture.origin}/v1/tasks/${id}`)).json();
        assert.equal(task.data.status, 'completed');
    });
    await check('chat stream/tool loading', async () => {
        const response = await fetch(`${fixture.origin}/v1/chat/completions`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: 'fixture-chat', stream: true, messages: [{role: 'user', content: '[fixture:project]'}], tools: [{type: 'function', function: {name: 'load_tool_groups'}}]})});
        const text = await response.text();
        assert.ok(text.includes('load_tool_groups'));
        assert.ok(text.includes('story-edit'));
        assert.ok(text.includes('[DONE]'));
    });
    await check('Responses text/reasoning fixture passes the real product stream parser', async () => {
        let content = '', reasoning = '';
        const result = await streamResponses(responsesInput([{role: 'user', content: '验证 Responses'}]),
            {fetchImpl: fetch, onDelta: value => {content += value;}, onReasoning: value => {reasoning += value;}});
        assert.equal(result.ok, true, result.message);
        assert.equal(result.via, 'stream');
        assert.equal(result.content, content);
        assert.equal(result.reasoning, reasoning);
        assert.equal(reasoning, '正在验证原生传输。');
        assert.ok(content.includes('中文与 🌹'));
        assert.equal(result.finishReason, 'stop');
        assert.equal(result.usage.totalTokens, 30);
        assert.equal(result.responseOutput[0].type, 'reasoning');
    });
    await check('Responses overview tool and stateless continuation pass the real parser', async () => {
        const messages = [{role: 'user', content: '[fixture:overview]'}];
        const tools = [{type: 'function', function: {name: 'workspace_overview', parameters: {type: 'object', properties: {}, additionalProperties: false}}}];
        const input = responsesInput(messages, tools);
        const first = await streamResponses(input, {fetchImpl: fetch});
        assert.equal(first.ok, true, first.message);
        assert.equal(first.finishReason, 'tool_calls');
        assert.equal(first.reasoning, '正在验证原生传输。');
        assert.equal(first.content, '');
        assert.equal(first.toolCalls.length, 1);
        assert.equal(first.toolCalls[0].function.name, 'workspace_overview');
        assert.deepEqual(JSON.parse(first.toolCalls[0].function.arguments), {});
        const second = await streamResponses({...input, responseItems: [...toResponseInput(messages), ...first.responseOutput,
            {type: 'function_call_output', call_id: first.toolCalls[0].id, output: '{}'}]}, {fetchImpl: fetch});
        assert.equal(second.ok, true, second.message);
        assert.equal(second.finishReason, 'stop');
        assert.equal(second.toolCalls, undefined);
        assert.equal(second.reasoning, '正在验证原生传输。');
        assert.ok(second.content.includes('已收到真实工具执行结果'));
    });
    await check('Responses mismatched final reasoning still rejects without dispatching tools', async () => {
        const tools = [{type: 'function', function: {name: 'workspace_overview', parameters: {type: 'object', properties: {}, additionalProperties: false}}}];
        let reasoning = '';
        const result = await streamResponses(responsesInput([{role: 'user', content: '[fixture:overview]'}], tools), {
            onReasoning: value => {reasoning += value;},
            fetchImpl: async (url, init) => {
                const response = await fetch(url, init);
                // Reproduce the original fixture defect from its actual wire bytes.
                // Product decoding/consistency/security logic remains unchanged.
                const wire = (await response.text()).split(/\r?\n/).map(line => {
                    if (!line.startsWith('data: {')) return line;
                    const value = JSON.parse(line.slice(6));
                    if (value.type === 'response.completed') value.response.output = value.response.output.filter(item => item.type !== 'reasoning');
                    return `data: ${JSON.stringify(value)}`;
                }).join('\r\n');
                return new Response(wire, {status: response.status, headers: response.headers});
            }
        });
        assert.equal(reasoning, '正在验证原生传输。');
        assert.equal(result.ok, false);
        assert.equal(result.message, 'Responses 最终内容与流事件不一致');
        assert.equal(result.toolCalls, undefined);
    });
    await check('HTTP 429 remains provider rejection', async () => {
        const response = await post('/v1/chat/completions', {model: 'fixture-http-error', messages: [{role: 'user', content: '验证 429'}]});
        assert.equal(response.status, 429);
        assert.equal((await response.json()).error.message, 'Synthetic provider rejection');
    });
    await check('UI tool command loads and uses actual advertised schema once', async () => {
        const user = command('generation_capabilities', {});
        const loader = {type: 'function', function: {name: 'load_tool_groups', parameters: {type: 'object'}}};
        const first = await (await post('/v1/chat/completions', {model: 'fixture-chat', stream: true, messages: [user], tools: [loader]})).text();
        const call = calls(first)[0];
        assert.equal(call.function.name, 'load_tool_groups');
        assert.deepEqual(JSON.parse(call.function.arguments), {groupIds: ['media-generation']});
        const history = [user, {role: 'assistant', content: null, tool_calls: [call]}, {role: 'tool', tool_call_id: call.id, content: '{}'}];
        const actualShape = {type: 'object', properties: {projectId: {type: 'string', minLength: 1, maxLength: 160}}, additionalProperties: false};
        const tool = {type: 'function', function: {name: 'generation_capabilities', parameters: actualShape}};
        const second = await (await post('/v1/chat/completions', {model: 'fixture-chat', stream: true, messages: history, tools: [loader, tool]})).text();
        const capabilityCall = calls(second)[0];
        assert.equal(capabilityCall.function.name, 'generation_capabilities');
        assert.equal(capabilityCall.function.arguments, '{}');
        const complete = [...history, {role: 'assistant', content: null, tool_calls: [capabilityCall]}, {role: 'tool', tool_call_id: capabilityCall.id, content: '{}'}];
        const third = await (await post('/v1/chat/completions', {model: 'fixture-chat', stream: true, messages: complete, tools: [loader, tool]})).text();
        assert.equal(calls(third).length, 0);
        assert.ok(third.includes('不会代替用户确认'));
        const invalid = await (await post('/v1/chat/completions', {model: 'fixture-chat', stream: true, messages: [command('generation_capabilities', {unexpected: true})], tools: [tool]})).text();
        assert.equal(calls(invalid).length, 0);
        assert.ok(invalid.includes('schema 不匹配'));
    });
    await check('Responses supplied tool arguments survive real product parser', async () => {
        const tool = {type: 'function', function: {name: 'audio_generate_speech', parameters: {type: 'object', required: ['text'], properties: {text: {type: 'string'}, voice: {type: 'string', enum: ['alloy']}}, additionalProperties: false}}};
        const result = await streamResponses(responsesInput([command('audio_generate_speech', {text: '仅合成验收', voice: 'alloy'})], [tool]), {fetchImpl: fetch});
        assert.equal(result.ok, true, result.message);
        assert.equal(result.toolCalls[0].function.name, 'audio_generate_speech');
        assert.deepEqual(JSON.parse(result.toolCalls[0].function.arguments), {text: '仅合成验收', voice: 'alloy'});
    });
    await check('image/video/music task URLs and binary downstream', async () => {
        for (const [path, model, kind] of [['images', 'gpt-image-2.5-flare', 'image'], ['videos', 'MiniMax-H3', 'video'], ['music', 'flowmusic', 'audio']]) {
            const submission = await (await post(`/v1/${path}/generations`, {model, prompt: '合成验收'}, {Authorization: 'Bearer synthetic-local-only'})).json();
            const taskId = submission.data[0].task_id;
            const taskPath = `/v1/${path === 'music' ? 'music/' : ''}tasks/${taskId}`;
            const task = await (await fetch(`${fixture.origin}${taskPath}`, {headers: {Authorization: 'Bearer synthetic-local-only'}})).json();
            const resultUrl = kind === 'audio' ? task.data.result.music[0].audio_url : task.data.result[kind === 'image' ? 'images' : 'videos'][0].url[0];
            const response = await fetch(resultUrl);
            assert.ok((await response.arrayBuffer()).byteLength > 0);
            const download = fixture.events.findLast(entry => entry.type === 'request' && entry.path === `/media/${kind}`);
            assert.equal(download.authorizationPresent, false);
            assert.equal(download.cookiePresent, false);
        }
    });
    await check('speech direct binary and MiMo JSON-base64 fixtures', async () => {
        const speech = await post('/v1/audio/speech', {model: 'gpt-4o-mini-tts', input: '合成验收', voice: 'alloy', response_format: 'wav'});
        assert.equal(speech.headers.get('content-type'), 'audio/wav');
        assert.ok((await speech.arrayBuffer()).byteLength > 44);
        const mimo = await (await post('/v1/chat/completions', {model: 'mimo-v2.5-tts', messages: [{role: 'assistant', content: '合成验收'}], audio: {format: 'wav', voice: 'mimo_default'}, stream: false})).json();
        assert.equal(Buffer.from(mimo.choices[0].message.audio.data, 'base64').toString('ascii', 0, 4), 'RIFF');
    });
    await check('cross-origin 307 oracle records target headers without making native claims', async () => {
        const body = {model: 'fixture-redirect', stream: true, messages: [{role: 'user', content: '合成重定向验收'}]};
        const source = await fetch(`${fixture.origin}/v1/chat/completions`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer synthetic-local-only'}, body: JSON.stringify(body), redirect: 'manual'});
        assert.equal(source.status, 307);
        const target = new URL(source.headers.get('location'));
        assert.notEqual(target.origin, fixture.origin);
        assert.equal(target.hostname, 'localhost');
        const followed = await fetch(target, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
        const text = await followed.text();
        assert.ok(text.includes('authorization=false'));
        assert.ok(text.includes('cookie=false'));
        const request = fixture.events.findLast(entry => entry.type === 'request' && entry.query === '?redirected=1');
        assert.equal(request.authorizationPresent, false);
        assert.equal(request.cookiePresent, false);
        const task = await (await post('/v1/images/generations', {model: 'gpt-image-2.5-flare', prompt: '[fixture:cross-origin-media]'})).json();
        const status = await (await fetch(`${fixture.origin}/v1/tasks/${task.data[0].task_id}`)).json();
        assert.equal(new URL(status.data.result.images[0].url[0]).hostname, 'localhost');
    });
    await check('stalled read abort/disconnect', async () => {
        const controller = new AbortController();
        const response = await fetch(`${fixture.origin}/stalled-body`, {signal: controller.signal});
        const reader = response.body.getReader();
        await reader.read();
        const pending = reader.read();
        controller.abort();
        await assert.rejects(pending);
        const deadline = Date.now() + 1000;
        while (!fixture.events.some(event => event.type === 'disconnect' && event.path === '/stalled-body' && !event.finished) && Date.now() < deadline) await new Promise(accept => setTimeout(accept, 10));
        assert.ok(fixture.events.some(event => event.type === 'disconnect' && event.path === '/stalled-body' && !event.finished));
    });
    console.log(JSON.stringify({passed, limits: 'Node fetch proves fixture behavior only, not native transport or packaged product acceptance.'}));
} finally {
    try { await parserServer?.close(); } finally { await fixture.close(); }
}
