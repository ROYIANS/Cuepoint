import {appendFile} from 'node:fs/promises';
import {TARGETS,runContext} from './release-policy.mjs';
import {sourceVersion} from './build-release.mjs';
const context={...runContext(),version:await sourceVersion()};
if (context.tag && context.tag !== `desktop-v${context.version}`) throw new Error('Tag/version mismatch');
if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT required');
const matrix={include:Object.values(TARGETS).map(target=>({target:target.id,runner:target.runner,triple:target.triple}))};
await appendFile(process.env.GITHUB_OUTPUT,`matrix=${JSON.stringify(matrix)}\nversion=${context.version}\n`);
