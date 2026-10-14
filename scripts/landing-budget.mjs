// Verifies the standalone landing entry after `pnpm build`:
//  - dist/landing.html loads the landing entry chunk, not the application's;
//  - the entry's static module closure (and its lazy chunks) contains no
//    application/storage/router/UI modules;
//  - first-screen JS/CSS gzip size stays within budget;
//  - the desktop frontend build cannot ship the landing page.
// Module lists come from dist/.vite/chunk-modules.json (emitted by the plugin in
// vite.config.ts from Rollup's chunk.moduleIds), the closure from the Vite manifest.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const dist = resolve(root, option('dist', 'dist'));
const jsBudgetKb = Number(option('js-kb', 120));
const cssBudgetKb = Number(option('css-kb', 15));

const FORBIDDEN_PACKAGES = ['dexie', 'zod', 'antd', '@lobehub/', '@tanstack/react-router', '@tauri-apps/'];
const FORBIDDEN_SOURCES = ['src/db/', 'src/lib/storage/', 'src/main.tsx', 'src/styles.css', 'src/components/'];
const EXEMPT_SOURCES = new Set(['src/lib/umami.ts', 'src/lib/brand.ts']);

const failures = [];
const fail = message => failures.push(message);
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const gzipSize = file => gzipSync(readFileSync(resolve(dist, file))).length;

function packageOf(modulePath) {
    const index = modulePath.lastIndexOf('node_modules/');
    return index < 0 ? undefined : modulePath.slice(index + 'node_modules/'.length);
}

function violation(modulePath) {
    const pkg = packageOf(modulePath);
    if (pkg) {
        const hit = FORBIDDEN_PACKAGES.find(name => pkg === name || pkg.startsWith(name.endsWith('/') ? name : `${name}/`));
        return hit && `forbidden package ${hit}`;
    }
    if (modulePath.startsWith('src/landing/') || EXEMPT_SOURCES.has(modulePath)) return undefined;
    const hit = FORBIDDEN_SOURCES.find(prefix => modulePath.startsWith(prefix));
    if (hit) return `forbidden application module ${hit}`;
    return modulePath.startsWith('src/') ? 'application module outside src/landing' : undefined;
}

function main() {
    const manifestPath = resolve(dist, '.vite/manifest.json');
    const modulesPath = resolve(dist, '.vite/chunk-modules.json');
    if (!existsSync(manifestPath) || !existsSync(modulesPath)) throw new Error('Run pnpm build first: dist/.vite/manifest.json and chunk-modules.json are required');
    const manifest = readJson(manifestPath);
    const chunkModules = readJson(modulesPath);
    const entry = manifest['landing.html'];
    const appEntry = manifest['index.html'];
    if (!entry?.isEntry) throw new Error('Manifest has no landing.html entry');

    const htmlPath = resolve(dist, 'landing.html');
    if (!existsSync(htmlPath)) fail('dist/landing.html is missing');
    else {
        const html = readFileSync(htmlPath, 'utf8');
        const scripts = [...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)].map(match => match[1].replace(/^\//, ''));
        if (scripts.length !== 1 || scripts[0] !== entry.file) fail(`landing.html module scripts ${JSON.stringify(scripts)} must be exactly ${entry.file}`);
        if (appEntry && scripts.includes(appEntry.file)) fail('landing.html loads the application entry chunk');
    }

    // Static closure (first screen) and lazy closure, both over manifest keys.
    const walk = (start, edge) => {
        const seen = new Set();
        const visit = key => {
            if (seen.has(key) || !manifest[key]) return;
            seen.add(key);
            for (const next of manifest[key][edge] ?? []) visit(next);
        };
        visit(start);
        return seen;
    };
    const eager = walk('landing.html', 'imports');
    const lazy = new Set();
    for (const key of eager) for (const next of manifest[key].dynamicImports ?? []) for (const item of walk(next, 'imports')) if (!eager.has(item)) lazy.add(item);

    const rows = [];
    let js = 0;
    const css = new Set();
    for (const [label, keys] of [['eager', eager], ['lazy', lazy]]) {
        for (const key of keys) {
            const chunk = manifest[key];
            const modules = chunkModules[chunk.file];
            if (!modules) fail(`No module list for chunk ${chunk.file}`);
            for (const modulePath of modules ?? []) {
                const reason = violation(modulePath);
                if (reason) fail(`${label} chunk ${chunk.file} contains ${modulePath}: ${reason}`);
            }
            const size = gzipSize(chunk.file);
            rows.push({kind: label, file: chunk.file, type: 'js', gzip: size});
            if (label === 'eager') {
                js += size;
                for (const file of chunk.css ?? []) css.add(file);
            }
        }
    }
    let cssTotal = 0;
    for (const file of css) {
        const size = gzipSize(file);
        cssTotal += size;
        rows.push({kind: 'eager', file, type: 'css', gzip: size});
    }
    if (js > jsBudgetKb * 1024) fail(`First-screen JS ${(js / 1024).toFixed(1)} KB gzip exceeds ${jsBudgetKb} KB`);
    if (cssTotal > cssBudgetKb * 1024) fail(`First-screen CSS ${(cssTotal / 1024).toFixed(1)} KB gzip exceeds ${cssBudgetKb} KB`);

    for (const row of rows) console.log(`${row.kind.padEnd(6)} ${row.type.padEnd(3)} ${(row.gzip / 1024).toFixed(2).padStart(8)} KB gzip  ${row.file}`);
    console.log(`first-screen JS  ${(js / 1024).toFixed(2)} KB gzip (budget ${jsBudgetKb} KB)`);
    console.log(`first-screen CSS ${(cssTotal / 1024).toFixed(2)} KB gzip (budget ${cssBudgetKb} KB)`);
    console.log(`modules checked  ${[...eager, ...lazy].reduce((sum, key) => sum + (chunkModules[manifest[key].file]?.length ?? 0), 0)} across ${eager.size + lazy.size} chunks`);

    checkDesktop();
}

function checkDesktop() {
    const script = readFileSync(resolve(root, 'desktop/tauri/scripts/build-frontend-worker.mjs'), 'utf8');
    if (!script.includes('configFile:false')) fail('Desktop frontend build no longer uses an isolated Vite config');
    if (/landing|rollupOptions/.test(script)) fail('Desktop frontend build references landing or custom Rollup inputs');
    const output = resolve(root, 'desktop/tauri/dist/normal');
    if (existsSync(output)) {
        const assets = existsSync(resolve(output, 'assets')) ? readdirSync(resolve(output, 'assets')) : [];
        if (existsSync(resolve(output, 'landing.html')) || assets.some(name => name.startsWith('landing'))) fail('Desktop output contains the landing page');
        console.log('desktop output   checked desktop/tauri/dist/normal: no landing.html or landing assets');
    } else console.log('desktop output   absent; checked build script source only');
}

try {
    main();
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
if (failures.length) {
    console.error(`\nlanding:budget FAILED\n${failures.map(message => `- ${message}`).join('\n')}`);
    process.exit(1);
}
console.log('landing:budget passed');
