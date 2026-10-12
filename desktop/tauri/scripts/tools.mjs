import {runTool} from './tool-resolver.mjs';
const [command, ...args] = process.argv.slice(2);
if (!command || !['cargo', 'rustc', 'rustup', 'rustfmt', 'pnpm'].includes(command)) {
    throw new Error('Expected cargo, rustc, rustup, rustfmt or pnpm and arguments');
}
process.exitCode=(await runTool(command,args)).code;
