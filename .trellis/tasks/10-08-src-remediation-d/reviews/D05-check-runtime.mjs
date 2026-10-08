import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolve} from 'node:path';
import {createServer} from 'vite';
const task = '.trellis/tasks/10-08-src-remediation-d';
const server = await createServer({configFile: false, resolve: {alias: {'@': resolve('src')}}, server: {host: '127.0.0.1', port: 0}});
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
try {
    const current = await server.ssrLoadModule('/src/lib/agent/tools.ts');
    const original = await server.ssrLoadModule(`/${task}/tools/d05/before/src/lib/agent/tools.ts`);
    const advertise = tools => JSON.stringify(tools.map(tool => ({name: tool.name, title: tool.title, description: tool.description, parameters: tool.parameters, effect: tool.effect, atomic: tool.atomic, recovery: tool.recovery, requiresConfirmation: tool.requiresConfirmation})), null, 2) + '\n';
    const a = advertise(original.BUILTIN_TOOLS), b = advertise(current.BUILTIN_TOOLS);
    assert.equal(b, a); assert.equal(b, fs.readFileSync('tests/fixtures/d05/catalog.json', 'utf8'));
    assert.equal(current.BUILTIN_TOOLS.length, 89);
    function seed(s, optional = false, branch = 0) {
        if (Array.isArray(s.anyOf ?? s.oneOf)) return seed((s.anyOf ?? s.oneOf)[branch % (s.anyOf ?? s.oneOf).length], optional);
        if (Array.isArray(s.enum)) return s.enum[branch % s.enum.length];
        if (s.type === 'string') return 'x'.repeat(Math.max(1, Number(s.minLength ?? 1)));
        if (s.type === 'number' || s.type === 'integer') return s.minimum ?? 1;
        if (s.type === 'boolean') return false;
        if (s.type === 'array') return Array.from({length: Number(s.minItems ?? 0)}, () => seed(s.items ?? {}, optional));
        return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([key]) => optional || (s.required ?? []).includes(key)).map(([key, value]) => [key, seed(value, optional)]));
    }
    const outcome = (tool, raw) => {
        try {return {output: JSON.stringify(tool.parseArguments(raw))};}
        catch (e) {return e && typeof e === 'object' && 'issues' in e ? {issues: JSON.stringify(e.issues)} : {error: e instanceof Error ? `${e.name}:${e.message}` : String(e)};}
    };
    let parserCases = 0;
    const perTool = [];
    for (let i = 0; i < current.BUILTIN_TOOLS.length; i++) {
        const c = current.BUILTIN_TOOLS[i], o = original.BUILTIN_TOOLS[i];
        assert.equal(c.name, o.name);
        const cases = [undefined, null, [], {}, {unexpected: true}, seed(o.parameters), seed(o.parameters, true)];
        const properties = o.parameters.properties ?? {};
        for (const [key, schema] of Object.entries(properties)) {
            const base = seed(o.parameters, true);
            cases.push({...base, [key]: undefined}, {...base, [key]: null}, {...base, [key]: []}, {...base, [key]: {unexpected: true}});
            if (schema.type === 'string') {
                cases.push({...base, [key]: ''}, {...base, [key]: '  x  '}, {...base, [key]: ' '.repeat(Math.max(1, Number(schema.minLength ?? 1)))});
                if (schema.maxLength !== undefined) cases.push({...base, [key]: 'x'.repeat(schema.maxLength + 1)});
            }
            if (schema.type === 'integer' || schema.type === 'number') for (const n of [-1, 0, 1.5, NaN, Infinity, schema.maximum === undefined ? 1e9 : schema.maximum + 1]) cases.push({...base, [key]: n});
            if (Array.isArray(schema.enum)) for (const value of [...schema.enum, 'unsupported']) cases.push({...base, [key]: value});
            if (schema.type === 'array') for (const length of [0, Number(schema.minItems ?? 0), Number(schema.maxItems ?? 30) + 1]) cases.push({...base, [key]: Array.from({length}, () => seed(schema.items ?? {}, true))});
            if (Array.isArray(schema.anyOf)) for (let branch = 0; branch < schema.anyOf.length; branch++) cases.push({...base, [key]: seed(schema, true, branch)});
        }
        for (const raw of cases) {assert.deepEqual(outcome(c, raw), outcome(o, raw), `Parser bytes/issues changed: ${c.name}`); parserCases++;}
        perTool.push({name: c.name, cases: cases.length});
    }
    const nowMemory = await server.ssrLoadModule('/src/lib/memory/retrieval.ts');
    const oldMemory = await server.ssrLoadModule(`/${task}/tools/d05/before/src/lib/memory/retrieval.ts`);
    const sources = [{kind: 'manual', private: 'hidden'}, {kind: 'summary', taskTitle: '任务', taskId: 't', summaryId: 's', summaryRevision: 0, itemKind: 'lesson', itemIndex: 0, private: 'hidden'}, {kind: 'summary'}, {kind: 'imported', taskTitle: '任务', summaryRevision: 0, private: 'hidden'}, {kind: 'imported'}, {kind: 'future', private: 'hidden'}];
    const entries = sources.map(source => ({body: '雨夜', source, extra: 0, id: 'entry', revision: 1, title: '雨夜', category: 'lesson', inclusion: 'project', applicability: '镜头创作', reason: '用户标记为项目通用'}));
    let serializerCases = 0;
    for (const items of [[], ...entries.map(entry => [entry]), entries]) {
        assert.equal(nowMemory.serializeMemoryEntries(items), oldMemory.serializeMemoryEntries(items));
        assert.equal(nowMemory.memoryEnvelopeTokens(nowMemory.serializeMemoryEntries(items)), oldMemory.memoryEnvelopeTokens(oldMemory.serializeMemoryEntries(items)));
        serializerCases++;
    }
    for (const source of [null, undefined]) {
        let currentError, originalError;
        try {nowMemory.serializeMemoryEntries([{...entries[0], source}]);} catch (e) {currentError = [e.name, e.message];}
        try {oldMemory.serializeMemoryEntries([{...entries[0], source}]);} catch (e) {originalError = [e.name, e.message];}
        assert.deepEqual(currentError, originalError); assert.equal(currentError?.[0], 'TypeError'); serializerCases++;
    }
    const report = {registered: 89, originalCatalogSha256: sha(a), currentCatalogSha256: sha(b), fixtureCatalogSha256: sha(fs.readFileSync('tests/fixtures/d05/catalog.json')), parserCases, perTool, serializerCases, outputAndIssueByteEquality: true, limitation: 'Finite boundary matrix; unchanged parser/refinement source and original entry provenance provide complementary evidence. No tool execution or provider requests.'};
    fs.writeFileSync(`${task}/reviews/D05-check-runtime.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({...report, perTool: undefined}));
} finally {await server.close();}
