import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const prefix = 'packages/studio/src/';

/** The relocation ledger is executable policy, not a source-reachability entry list. */
export function checkStudioOwnership(root, edges) {
    const policyPath = join(root, 'quality/studio-ownership.json');
    if (!existsSync(join(root, prefix))) return {failures: [], files: []};
    if (!existsSync(policyPath)) return {failures: [{kind: 'missing-studio-ownership-policy'}], files: []};
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    if (policy.schemaVersion !== 1 || !Array.isArray(policy.files)) throw new Error('Invalid Studio ownership policy');
    const failures = [], files = [], byFile = new Map();
    function visit(directory) {
        for (const entry of readdirSync(join(root, directory), {withFileTypes: true})) {
            const file = `${directory}/${entry.name}`;
            if (entry.isDirectory()) visit(file);
            else if (entry.isFile()) files.push(file);
        }
    }
    visit(prefix.slice(0, -1));
    for (const row of policy.files) {
        if (typeof row.file !== 'string' || !row.file.startsWith(prefix) || row.file.includes('..') || typeof row.owner !== 'string') throw new Error('Invalid Studio source owner');
        if (byFile.has(row.file)) failures.push({kind: 'duplicate-studio-owner', file: row.file});
        byFile.set(row.file, row);
        if (!files.includes(row.file)) failures.push({kind: 'missing-studio-owned-source', file: row.file});
        const target = typeof row.target === 'string' ? row.target.slice(prefix.length) : '';
        const targetOwner = target.startsWith('features/') ? target.split('/').slice(0, 2).join('/') : target.startsWith('platform/') ? target.split('/').slice(0, 2).join('/') : target.split('/')[0];
        if (policy.phase === 'complete' && targetOwner !== row.owner) failures.push({kind: 'studio-owner-path-mismatch', file: row.file});
        if (policy.phase === 'complete' && row.file !== row.target) failures.push({kind: 'pending-studio-relocation', file: row.file});
        if (row.original && row.original !== row.file && existsSync(join(root, row.original))) failures.push({kind: 'old-studio-source-bridge', file: row.original});
    }
    for (const file of files) if (!byFile.has(file)) failures.push({kind: 'unmapped-studio-source', file});
    for (const edge of edges) {
        if (!edge.from.startsWith(prefix)) continue;
        const from = edge.from.slice(prefix.length), to = edge.to.slice(prefix.length);
        const source = byFile.get(edge.from), target = byFile.get(edge.to);
        if (from.startsWith('platform/') && to.startsWith('app/')) failures.push({...edge, kind: 'platform-app-edge'});
        if (from.startsWith('platform/storage/') && (to.startsWith('app/') || to.startsWith('platform/product/') || edge.specifier === 'react' || edge.specifier.startsWith('react/'))) {
            failures.push({...edge, kind: 'storage-integration-edge'});
        }
        const symbols = edge.symbols ?? [{name: '*', typeOnly: edge.typeOnly}];
        const permitsValues = target && (target.public || symbols.length > 0 && symbols.filter(item => !item.typeOnly).every(item => target.publicSymbols?.includes(item.name)));
        const permitsTypes = target && symbols.filter(item => item.typeOnly).every(item => target.publicTypes?.includes(item.name));
        const layer = from.startsWith('features/') ? from.split('/')[2] : null;
        if (layer && to.startsWith('app/') && (layer !== 'ui' && layer !== 'presentation' || !policy.featureUiAppEntries.some(entry => entry.file === to && symbols.length > 0 && symbols.every(item => entry.symbols.includes(item.name))))) failures.push({...edge, kind: 'feature-app-runtime-edge'});
        if (['models', 'commands', 'queries'].includes(layer) && /^(features\/[^/]+\/(?:ui|presentation)\/|ui\/|app\/)/.test(to)) failures.push({...edge, kind: 'feature-data-ui-edge'});
        if (edge.typeOnly) {
            if (to.startsWith('features/') && source?.owner !== target?.owner && !permitsTypes) failures.push({...edge, kind: 'private-feature-type-import'});
            if (from.startsWith('ui/') && /^(features|app|platform\/product)\//.test(to)) failures.push({...edge, kind: 'neutral-ui-business-edge'});
            continue;
        }
        if (from.startsWith('platform/') && to.startsWith('features/') && !(from === 'platform/storage/browserDatabase.ts' && policy.storageParserEntries.includes(to))) failures.push({...edge, kind: 'platform-feature-runtime-edge'});
        if (from.startsWith('ui/') && (to.startsWith('features/') || to.startsWith('app/') || to.startsWith('platform/product/'))) failures.push({...edge, kind: 'neutral-ui-business-edge'});
        if (source?.owner.startsWith('features/') && target?.owner.startsWith('features/') && source.owner !== target.owner && to.startsWith('features/') && (!permitsValues || !permitsTypes)) failures.push({...edge, kind: 'private-feature-import'});

    }
    return {files: files.sort(), failures};
}
