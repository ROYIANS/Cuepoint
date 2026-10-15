import {mkdir, readFile, readdir, rename, rm} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

async function files(directory, prefix = '') {
    const result = [];
    for (const entry of await readdir(join(directory, prefix), {withFileTypes: true})) {
        const name = join(prefix, entry.name);
        if (entry.isDirectory()) result.push(...await files(directory, name));
        else if (entry.isFile()) result.push(name);
        else throw new Error(`Unexpected output entry: ${name}`);
    }
    return result;
}

export async function assembleWeb({web, site, output}) {
    const reports = ['.vite/manifest.json', '.vite/chunk-modules.json'];
    const merged = Object.fromEntries(reports.map(file => [file, {}]));
    const pending = new Map();
    for (const directory of [web, site]) {
        for (const file of await files(directory)) {
            const bytes = await readFile(join(directory, file));
            if (reports.includes(file)) {
                const entries = JSON.parse(bytes.toString());
                for (const [key, value] of Object.entries(entries)) {
                    const previous = merged[file][key];
                    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(value)) throw new Error(`Output report collision: ${file}:${key}`);
                    merged[file][key] = value;
                }
            } else {
                if (pending.has(file) && !pending.get(file).equals(bytes)) throw new Error(`Output file collision: ${file}`);
                pending.set(file, bytes);
            }
        }
    }
    const manifest = merged['.vite/manifest.json'];
    if (!manifest['index.html']?.isEntry || !manifest['landing.html']?.isEntry || !pending.has('index.html') || !pending.has('landing.html')) throw new Error('Both application HTML entries are required');
    for (const [key, row] of Object.entries(manifest)) {
        for (const edge of [...(row.imports ?? []), ...(row.dynamicImports ?? [])]) if (!Object.hasOwn(manifest, edge)) throw new Error(`Missing manifest edge ${key}:${edge}`);
        for (const file of [row.file, ...(row.css ?? []), ...(row.assets ?? [])]) if (!pending.has(file)) throw new Error(`Missing output file ${file}`);
        if (row.file.endsWith('.js') && !Object.hasOwn(merged['.vite/chunk-modules.json'], row.file)) throw new Error(`Missing module report ${row.file}`);
    }
    for (const entry of ['index.html', 'landing.html']) {
        const html = pending.get(entry).toString();
        const scripts = [];
        for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
            const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, name, value]) => [name.toLowerCase(), value]));
            const isScript = /^<script\b/i.test(tag);
            const resource = isScript ? attributes.src : /^(?:stylesheet|modulepreload|icon)$/i.test(attributes.rel ?? '') ? attributes.href : undefined;
            if (!resource || /^(?:[a-z]+:|\/\/|#)/i.test(resource)) continue;
            const file = resource.replace(/^\//, '').split(/[?#]/)[0];
            if (!pending.has(file)) throw new Error(`Missing HTML resource ${entry}:${file}`);
            if (isScript && attributes.type === 'module') scripts.push(file);
        }
        if (!scripts.includes(manifest[entry].file)) throw new Error(`HTML entry does not load its manifest module: ${entry}`);
    }
    const stage = `${resolve(output)}.assembling`;
    await mkdir(stage, {recursive: false});
    try {
        const {writeFile} = await import('node:fs/promises');
        for (const [file, bytes] of pending) {await mkdir(dirname(join(stage, file)), {recursive: true}); await writeFile(join(stage, file), bytes);}
        for (const file of reports) {await mkdir(dirname(join(stage, file)), {recursive: true}); await writeFile(join(stage, file), JSON.stringify(merged[file]));}
        await rm(output, {recursive: true, force: true});
        await rename(stage, output);
    } finally {await rm(stage, {recursive: true, force: true});}
    return {files: pending.size, entries: Object.keys(manifest).length};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL('../', import.meta.url));
    console.log(await assembleWeb({web: join(root, 'apps/web/dist'), site: join(root, 'apps/site/dist'), output: join(root, 'dist')}));
}
