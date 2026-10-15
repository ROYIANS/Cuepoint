import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {assembleWeb} from './assemble-web.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const vite = join(require.resolve('vite/package.json'), '../bin/vite.js');
for (const name of ['web', 'site']) {
    const code = await new Promise((accept, reject) => {
        const child = spawn(process.execPath, [vite, 'build'], {cwd: join(root, 'apps', name), env: process.env, stdio: 'inherit', shell: false});
        child.once('error', reject); child.once('close', (code, signal) => accept(signal ? 1 : code ?? 1));
    });
    if (code !== 0) process.exit(code);
}
console.log('Assembled web/site:', await assembleWeb({web: join(root, 'apps/web/dist'), site: join(root, 'apps/site/dist'), output: join(root, 'dist')}));
