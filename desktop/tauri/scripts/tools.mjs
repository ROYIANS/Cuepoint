import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, delimiter} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const localBin = resolve(root, '.tools/cargo/bin');
const localNodeBin = '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin';
const [command, ...args] = process.argv.slice(2);
if (!command || !['cargo', 'rustc', 'rustup', 'rustfmt', 'pnpm'].includes(command)) {
    throw new Error('Expected cargo, rustc, rustup, rustfmt or pnpm and arguments');
}
const executable = command === 'pnpm'
    ? '/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
    : resolve(localBin, command);
const child = spawn(executable, args, {
    cwd: root,
    stdio: 'inherit',
    env: {...process.env,
        RUSTUP_HOME: resolve(root, '.tools/rustup'),
        CARGO_HOME: resolve(root, '.tools/cargo'),
        CARGO_TARGET_DIR: resolve(root, '.tools/target'),
        RUSTUP_TOOLCHAIN: '1.99.0',
        PATH: `${localBin}${delimiter}${localNodeBin}${delimiter}${process.env.PATH ?? ''}`,
    },
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
