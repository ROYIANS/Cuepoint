import ts from '/Users/xiaomengdao/WebstormProjects/aifenjing/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const task = '.trellis/tasks/10-08-src-remediation-d';
const entry = JSON.parse(fs.readFileSync(`${task}/tools/d05/entry.json`, 'utf8'));
const freeze = JSON.parse(fs.readFileSync(`${task}/reviews/D05-product-freeze.json`, 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePaths = Object.keys(freeze.frozenInputs).filter(file => /^(src|tests)\/.*\.tsx?$/.test(file));
const protocolOwners = new Set(['tools','toolDefinition','businessSchemas','businessStore','libraryToolHelpers','ipTools','audioTools','musicTools','audioGenerationTools','materialTools','toolLoading','taskTools','businessTools','generationTools','memoryTools','referenceTools','webTools','generationProfiles']);
function inventory(file, text) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const imports = source.statements.filter(ts.isImportDeclaration).flatMap(node => {
        const module = node.moduleSpecifier.text;
        const resolved = module.startsWith('@/') ? `src/${module.slice(2)}.ts` : path.normalize(path.join(path.dirname(file), `${module}.ts`));
        if (!resolved.startsWith('src/lib/agent/') || !protocolOwners.has(path.basename(resolved, '.ts'))) return [];
        return [{file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, module, owner: resolved, typeOnly: Boolean(node.importClause?.isTypeOnly), bindings: node.importClause?.namedBindings?.getText(source) ?? null}];
    });
    const declarations = [];
    function visit(node) {
        if ((ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) declarations.push({file, name: node.name.text, kind: ts.SyntaxKind[node.kind], line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, endLine: source.getLineAndCharacterOfPosition(node.end).line + 1});
        ts.forEachChild(node, visit);
    }
    visit(source);
    return {imports, declarations};
}
const before = [], after = [];
for (const file of sourcePaths) {
    const bytes = fs.readFileSync(file);
    if (digest(bytes) !== freeze.frozenInputs[file]) throw new Error(`Frozen source changed: ${file}`);
    after.push(inventory(file, bytes.toString('utf8')));
    if (!(file in entry.before)) continue;
    const saved = `${task}/tools/d05/before/${file}`;
    const original = fs.existsSync(saved) ? fs.readFileSync(saved) : bytes;
    if (digest(original) !== entry.before[file]) throw new Error(`Entry source cannot be reconstructed honestly: ${file}`);
    before.push(inventory(file, original.toString('utf8')));
}
const consumers = {compilerVersion: ts.version, before: before.flatMap(item => item.imports), after: after.flatMap(item => item.imports)};
fs.writeFileSync(`${task}/reviews/D05-consumer-map.json`, JSON.stringify(consumers, null, 2) + '\n');
const movements = [
    {name: 'AgentToolContext / AgentToolDefinition', before: 'tools.ts interfaces', after: 'toolDefinition.ts type protocol; tools.ts compatibility type exports', behavior: 'Function properties preserve schema output until one existential registry projection.'},
    {name: 'toolMetadataMatches', before: 'runChat.ts two inline five-field comparisons', after: 'toolDefinition.ts pure comparison; same two runChat gates', behavior: 'Effect, computed highRisk, normalized atomic, exact recovery, normalized requiresConfirmation; both timing positions unchanged.'},
    {name: 'generation submit/job contract', before: 'generationProfiles.ts Zod recipe + generationTools.ts independent JSON advertisement', after: 'generationProfiles.ts Spec recipes plus explicit legacy wire projections', behavior: 'Defaults, trimming, strictness, public pick/omit/shape, output/wire ordering and wire-only omissions remain preserved.'},
    {name: 'readBusinessRecord / listBusinessRecords', before: 'businessStore.ts getRow/listRows dynamic table read and media casts', after: 'businessStore.ts owned discriminated records; getRow/listRows compatibility presentation projection', behavior: 'Same owners/episode/media checks and original row envelopes; typed slot/shot consumers do not assert domain rows.'},
    {name: 'project_create write hooks', before: 'businessTools.ts writeTool name checks plus Args casts', after: 'businessTools.ts schema-inferred creation-only beforePreview/beforeWrite/completedReplay callbacks', behavior: 'Same read transaction, atomic transaction and preflight replay positions; original binding/replay/seed/receipt contract.'},
    {name: 'asset definitions', before: 'businessTools.ts Object.keys(assetApi).flatMap over heterogeneous fields/commands', after: 'businessTools.ts four concrete schema-bound create/update/delete branches', behavior: 'No generic CRUD factory; original registration ordering, title/description/schema and concrete command owners.'},
    {name: 'slot and patch projections', before: 'businessTools.ts domain patch/slot assertions', after: 'businessTools.ts native typed patch objects and execution-time catalog predicates', behavior: 'Nullable field presence and key ordering preserved; same paid-candidate selection/refinement/atomic restrictions.'},
    {name: 'audioMusicUnion and create branches', before: 'audioTools.ts ZodTypeAny tuple and Extract assertions', after: 'audioTools.ts mapped concrete schema tuple and whole-argument discriminant branches', behavior: 'Real audio Args reject numeric text and wrong-branch fields; runtime default speaker and sound receipts unchanged.'},
    {name: 'musicGenerateTool', before: 'audioGenerationTools.ts inline music_generate definition; musicGenerationReview array lookup', after: 'audioGenerationTools.ts named concrete definition at same registry slot; direct musicGenerationReview consumer', behavior: 'Own parse/prepare relation retained without importing the aggregate registry or replaying paid work.'},
    {name: 'projectMemorySource', before: 'retrieval.ts serializeMemoryEntries nested source ternary', after: 'retrieval.ts local exhaustive source projection plus serializer early-empty return', behavior: 'Original source whitelist, source/entry field ordering, envelope, spread, optional/zero behavior, malformed-source errors and unknown-kind manual fallback.'},
];
const changed = new Set(Object.keys(freeze.changes));
fs.writeFileSync(`${task}/reviews/D05-movement-map.json`, JSON.stringify({movements, beforeDeclarations: before.flatMap(item => item.declarations).filter(item => changed.has(item.file)), afterDeclarations: after.flatMap(item => item.declarations).filter(item => changed.has(item.file))}, null, 2) + '\n');
console.log(JSON.stringify({beforeConsumers: consumers.before.length, afterConsumers: consumers.after.length, movementContracts: movements.length}));
