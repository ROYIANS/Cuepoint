import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = process.cwd();
const destination = fileURLToPath(new URL('./registered-tool-inventory.json', import.meta.url));
const server = await createServer({configFile: false, server: {middlewareMode: true}, resolve: {alias: {'@': resolve(root, 'src')}}, optimizeDeps: {noDiscovery: true}});
try {
    const {BUILTIN_TOOLS} = await server.ssrLoadModule('/src/lib/agent/tools.ts');
    const testFiles = (await readdir(resolve(root, 'tests'))).filter(name => name.endsWith('.test.ts'));
    const tests = await Promise.all(testFiles.map(async name => ({path: `tests/${name}`, text: await readFile(resolve(root, 'tests', name), 'utf8')})));
    const tools = BUILTIN_TOOLS.map(tool => ({name: tool.name, title: tool.title, effect: tool.effect,
        sourceContractTests: tests.filter(test => test.text.includes(`"${tool.name}"`) || test.text.includes(`'${tool.name}'`)).map(test => test.path),
        packagedEvidence: 'pending'}));
    if (new Set(tools.map(tool => tool.name)).size !== tools.length) throw new Error('Duplicate registered names');
    await writeFile(destination, JSON.stringify({generatedFrom: 'Actual BUILTIN_TOOLS registry via Vite SSR, fake IndexedDB only', count: tools.length, limits: 'Test file references are a coverage map, not a passing result or proof of packaged execution.', tools}, null, 2) + '\n');
    console.log(JSON.stringify({registeredToolCount: tools.length, destination, missingExactNameReference: tools.filter(tool => !tool.sourceContractTests.length).map(tool => tool.name)}));
} finally {
    await server.close();
}
