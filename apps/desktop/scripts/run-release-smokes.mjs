import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {desktopRoot} from './tool-resolver.mjs';
import {getTarget,parseOptions} from './release-policy.mjs';
import {copyCheckReports} from './release-artifacts.mjs';
const options=parseOptions(process.argv.slice(2),['--receipt','--native-checks','--evidence-dir']);
if (Object.keys(options).length !== 3) throw new Error('Require --receipt, --native-checks, --evidence-dir');
const receiptPath=resolve(options['--receipt']),receipt=JSON.parse(await readFile(receiptPath,'utf8')),target=getTarget(receipt.target.id);
const reports=[resolve(options['--native-checks'])];
for (const asset of receipt.assets) {
    const evidence=resolve(options['--evidence-dir'],`smoke-${asset.format}`);
    const args=[resolve(desktopRoot,'../../tooling/release-product-smoke.mjs'),'--target',target.id,'--package',resolve(dirname(receiptPath),'assets',asset.name),'--receipt',receiptPath,'--evidence-dir',evidence];
    const command=target.platform === 'linux' ? '/usr/bin/xvfb-run' : process.execPath;
    const commandArgs=target.platform === 'linux' ? ['--auto-servernum',process.execPath,...args] : args;
    const code=await new Promise((accept,reject)=> {
        const child=spawn(command,commandArgs,{stdio:'inherit',shell:false});child.once('error',reject);child.once('exit',(code,signal)=>accept(signal ? 1 : code ?? 1));
    });
    if (code !== 0) throw new Error(`Required ${asset.format} payload smoke failed`);
    reports.push(resolve(evidence,'checks.json'));
}
await copyCheckReports(receiptPath,reports);
