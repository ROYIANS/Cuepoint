import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {test} from 'node:test';
import {workspaceFixture} from './quality-fixture.mjs';
import {assembleWeb} from './assemble-web.mjs';

test('actual architecture CLI rejects package bypasses and omitted owned sources', async () => {
    const f = await workspaceFixture();
    try {
        assert.equal((await f.check()).result.exitCode, 0);
        for (const source of [
            'import {value} from "@cuepoint/studio/entry"; console.log(value);',
            'import type {value} from "@cuepoint/studio/entry";',
            'import {value} from "../../desktop/src/main"; console.log(value);',
            'import {value} from "../../../packages/distribution/src/main"; console.log(value);',
            'import {value} from "@cuepoint/distribution/private"; console.log(value);',
            'import {value} from "@/lib/private"; console.log(value);',
        ]) {
            await f.write('apps/site/src/main.ts', source);
            const {result, report} = await f.check();
            assert.equal(result.exitCode, 1, `${source}: ${result.stderr}`);
            assert.ok(report.failures.some(row => /package|source-alias/.test(row.kind)), source);
        }
        await f.write('apps/site/src/main.ts', 'export const value = 1;');
        await f.write('apps/site/src/omitted.ts', 'export const omitted = 1;');
        await f.write('tsconfig.app.json', {...f.config, exclude: ['apps/site/src/omitted.ts']});
        const omitted = await f.check();
        assert.equal(omitted.result.exitCode, 1);
        assert.ok(omitted.report.failures.some(row => row.kind === 'owned-source-not-scanned' && row.file === 'apps/site/src/omitted.ts'));
        await f.write('tsconfig.app.json', f.config);
        await f.write('quality/workspaces.json', {...f.policy, packages: f.policy.packages.filter(row => row.name !== '@cuepoint/site')});
        assert.equal((await f.check()).result.exitCode, 2);
        await f.write('quality/workspaces.json', {...f.policy, packages: f.policy.packages.map(row => row.name === '@cuepoint/site' ? {...row, sources: []} : row)});
        assert.equal((await f.check()).result.exitCode, 2);
    } finally {await rm(f.directory, {recursive: true, force: true});}
});

test('web/site assembly preserves both entries and rejects incomplete or conflicting closure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cuepoint-web-assembly-'));
    const write = async (file, value) => {await mkdir(dirname(join(directory, file)), {recursive: true}); await writeFile(join(directory, file), typeof value === 'string' ? value : JSON.stringify(value));};
    const web = join(directory, 'web'), site = join(directory, 'site'), output = join(directory, 'output');
    const manifest = (name, entry) => ({[entry]: {isEntry: true, file: `assets/${name}.js`}});
    try {
        for (const [name, entry] of [['web', 'index.html'], ['site', 'landing.html']]) {
            await write(`${name}/${entry}`, `<script type="module" src="/assets/${name}.js"></script>`);
            await write(`${name}/assets/${name}.js`, `console.log(${JSON.stringify(name)});`);
            await write(`${name}/brand/shared.png`, 'identical-shared-bytes');
            await write(`${name}/.vite/manifest.json`, manifest(name, entry));
            await write(`${name}/.vite/chunk-modules.json`, {[`assets/${name}.js`]: [`apps/${name}/src/main.ts`]});
        }
        await assembleWeb({web, site, output});
        assert.deepEqual(Object.keys(JSON.parse(await readFile(join(output, '.vite/manifest.json'), 'utf8'))).sort(), ['index.html', 'landing.html']);
        assert.equal(await readFile(join(output, 'brand/shared.png'), 'utf8'), 'identical-shared-bytes');
        await write('site/brand/shared.png', 'conflict');
        await assert.rejects(assembleWeb({web, site, output}), /Output file collision/);
        assert.equal(await readFile(join(output, 'brand/shared.png'), 'utf8'), 'identical-shared-bytes');
        await write('site/brand/shared.png', 'identical-shared-bytes');
        await write('site/.vite/manifest.json', {...manifest('site', 'landing.html'), 'index.html': {file: 'different.js'}});
        await assert.rejects(assembleWeb({web, site, output}), /Output report collision/);
        await write('site/.vite/manifest.json', {'landing.html': {isEntry: true, file: 'missing.js'}});
        await assert.rejects(assembleWeb({web, site, output}), /Missing output file/);
        await write('site/.vite/manifest.json', {'landing.html': {isEntry: true, file: 'assets/site.js', imports: ['missing-key']}});
        await assert.rejects(assembleWeb({web, site, output}), /Missing manifest edge/);
        await write('site/.vite/manifest.json', manifest('site', 'landing.html'));
        await write('site/landing.html', '<script type="module" src="/missing.js"></script>');
        await assert.rejects(assembleWeb({web, site, output}), /Missing HTML resource/);
        await write('site/landing.html', '<script type="module" src="/assets/web.js"></script>');
        await assert.rejects(assembleWeb({web, site, output}), /HTML entry does not load its manifest module/);
        await write('site/landing.html', '<script type="module" src="/assets/site.js"></script><link rel="stylesheet" href="/missing.css">');
        await assert.rejects(assembleWeb({web, site, output}), /Missing HTML resource/);
        await write('site/landing.html', '<script type="module" src="/assets/site.js"></script>');
        await write('site/.vite/chunk-modules.json', {});
        await assert.rejects(assembleWeb({web, site, output}), /Missing module report/);
    } finally {await rm(directory, {recursive: true, force: true});}
});
