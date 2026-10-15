import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function workspacePolicy(root) {
    if (!existsSync(join(root, 'pnpm-workspace.yaml'))) return {packages: [], roots: ['src/']};
    const document = JSON.parse(readFileSync(join(root, 'quality/workspaces.json'), 'utf8'));
    const actual = [];
    for (const family of ['apps', 'packages']) for (const entry of readdirSync(join(root, family), {withFileTypes: true})) {
        if (entry.isDirectory() && existsSync(join(root, family, entry.name, 'package.json'))) actual.push(`${family}/${entry.name}`);
    }
    const declared = document.packages.map(row => row.path);
    if (new Set(declared).size !== declared.length || [...declared].sort().join() !== actual.sort().join()) throw new Error('Workspace coverage does not match actual application/library packages');
    const roots = [];
    for (const row of document.packages) {
        const pkg = JSON.parse(readFileSync(join(root, row.path, 'package.json'), 'utf8'));
        if (pkg.name !== row.name || !row.sources.includes('src') || !existsSync(join(root, row.path, 'src'))) throw new Error(`Missing registered owned source root: ${row.path}/src`);
        const internal = Object.entries({...pkg.dependencies, ...pkg.devDependencies}).filter(([name]) => name.startsWith('@cuepoint/'));
        if (internal.some(([name, version]) => !row.dependencies.includes(name) || version !== 'workspace:*')) throw new Error(`Forbidden workspace dependency: ${row.name}`);
        for (const source of row.sources) {
            if (!source || source.includes('..') || !existsSync(join(root, row.path, source))) throw new Error(`Missing owned source root: ${row.path}/${source}`);
            roots.push(`${row.path}/${source}/`);
        }
    }
    return {...document, roots};
}

export function packageBoundary(edge, policy) {
    const owner = file => policy.packages.find(row => file.startsWith(`${row.path}/`));
    const from = owner(edge.from), to = owner(edge.to);
    if (!from || !to) return undefined;
    if (edge.specifier.startsWith('@/') && from.name !== '@cuepoint/studio') return 'foreign-source-alias';
    if (from === to) return undefined;
    if (!from.dependencies.includes(to.name)) return 'forbidden-package-edge';
    if (!edge.specifier.startsWith(`${to.name}/`)) return 'cross-package-source-traversal';
    return undefined;
}

export function ownedTypescriptFiles(root, policy) {
    const files = [];
    function visit(directory) {
        for (const entry of readdirSync(join(root, directory), {withFileTypes: true})) {
            const file = `${directory}/${entry.name}`;
            if (entry.isDirectory()) visit(file);
            else if (entry.isFile() && /\.[cm]?tsx?$/.test(file) && !/\.d\.[cm]?ts$/.test(file)) files.push(file);
        }
    }
    for (const prefix of policy.roots) visit(prefix.replace(/\/$/, ''));
    return files.sort();
}

export function importContract(from, specifier, root, policy) {
    const owner = policy.packages.find(row => from.startsWith(`${row.path}/`));
    if (!owner) return undefined;
    if (specifier.startsWith('@/') && owner.name !== '@cuepoint/studio') return 'foreign-source-alias';
    if (!specifier.startsWith('@cuepoint/')) return undefined;
    const target = policy.packages.find(row => specifier === row.name || specifier.startsWith(`${row.name}/`));
    if (!target || (target !== owner && !owner.dependencies.includes(target.name))) return 'forbidden-package-import';
    const manifest = JSON.parse(readFileSync(join(root, target.path, 'package.json'), 'utf8'));
    const key = specifier === target.name ? '.' : `.${specifier.slice(target.name.length)}`;
    if (!Object.hasOwn(manifest.exports ?? {}, key)) return 'private-package-import';
    return undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const policy = workspacePolicy(fileURLToPath(new URL('../', import.meta.url)));
    console.log(`Workspace coverage: ${policy.packages.length} packages, ${policy.roots.length} registered source roots`);
}
