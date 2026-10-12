import {appendFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TARGETS,parseOptions,runContext} from './release-policy.mjs';
import {githubApi} from './publish-draft.mjs';

export async function selectArtifacts(api,context,kind='targets') {
    const artifacts=[];
    for (let page=1;page<=100;page++) {
        const result=await api.json('GET',`/repos/${context.repository}/actions/runs/${context.runId}/artifacts?per_page=100&page=${page}`);
        if (!Array.isArray(result.artifacts)) throw new Error('Malformed artifact response');
        artifacts.push(...result.artifacts);if (result.artifacts.length < 100) break;
        if (page === 100) throw new Error('Artifact pagination bound exceeded');
    }
    if (!['targets','set'].includes(kind)) throw new Error('Unknown artifact selection kind');
    return (kind === 'targets' ? Object.keys(TARGETS) : ['set']).map(target=> {
        const prefix=`desktop-${target}-${context.runId}-`;
        const candidates=artifacts.filter(artifact=>artifact.name.startsWith(prefix)).map(artifact=>({artifact,attempt:Number(artifact.name.slice(prefix.length))}));
        if (candidates.some(({attempt,artifact})=>!Number.isSafeInteger(attempt) || attempt < 1 || attempt > context.attempt || artifact.expired || artifact.workflow_run?.head_sha !== context.sourceSha)) throw new Error('Expired/future/wrong-source target artifact');
        if (!candidates.length) throw new Error(`Missing ${target} artifact`);
        const attempt=Math.max(...candidates.map(candidate=>candidate.attempt)),chosen=candidates.filter(candidate=>candidate.attempt === attempt);
        if (chosen.length !== 1) throw new Error('Ambiguous target artifacts');
        return {id:chosen[0].artifact.id,name:chosen[0].artifact.name,target,attempt,runId:context.runId};
    });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const options=parseOptions(process.argv.slice(2),['--output','--kind']);
    if (!options['--output']) throw new Error('Provide --output selection file');
    const selection=await selectArtifacts(githubApi(process.env.GITHUB_TOKEN),runContext(),options['--kind'] ?? 'targets');
    await writeFile(resolve(options['--output']),JSON.stringify(selection,null,2)+'\n',{flag:'wx'});
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT required');
    await appendFile(process.env.GITHUB_OUTPUT,`ids=${selection.map(item=>item.id).join(',')}\nname=${selection.length === 1 ? selection[0].name : ''}\n`);
}
