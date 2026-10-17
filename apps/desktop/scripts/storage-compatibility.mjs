import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const history='apps/desktop/src-tauri/src/full_product_store/registry-history';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function requireCompatibility(condition,message) {
    if (!condition) throw new Error(`Desktop storage compatibility: ${message}`);
}
function requireKeys(value,keys,owner) {
    requireCompatibility(value !== null && typeof value === 'object' && !Array.isArray(value) &&
        isDeepStrictEqual(Object.keys(value).sort(),keys.toSorted()),`invalid ${owner} fields`);
}
function parseJson(bytes) {
    const text=bytes.toString(),value=JSON.parse(text);
    // JSON.parse silently overwrites duplicate properties; native serde rejects them.
    // Valid JSON is established above, so punctuation outside strings is unambiguous.
    const tokens=[...text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]|[^\s{}[\]:,"]+/g)].map(match=>match[0]);
    const objects=[];
    for (let index=0;index<tokens.length;index++) {
        const token=tokens[index];
        if (token === '{') objects.push(new Set());
        else if (token === '}') objects.pop();
        else if (token.startsWith('"') && tokens[index+1] === ':') {
            const key=JSON.parse(token),keys=objects.at(-1);
            requireCompatibility(!keys.has(key),'duplicate JSON field');
            keys.add(key);
        }
    }
    return value;
}
function registryJson(bytes) {
    const registry=parseJson(bytes);
    requireKeys(registry,['version','tables'],'registry');
    requireCompatibility(registry.version === 1 && registry.tables !== null && typeof registry.tables === 'object' &&
        !Array.isArray(registry.tables) && Object.keys(registry.tables).length > 0,'unsupported registry format');
    const validPath=path=>typeof path === 'string' && path.split('.').every(part=>part.length > 0);
    for (const [name,table] of Object.entries(registry.tables)) {
        requireKeys(table,['keyPath','scope','indexes'],'table');
        requireCompatibility(name.length > 0 && validPath(table.keyPath) && ['content','device','mixed'].includes(table.scope) && Array.isArray(table.indexes),'invalid table definition');
        const indexes=new Set();
        for (const index of table.indexes) {
            requireKeys(index,['name','keyPaths','unique'],'index');
            requireCompatibility(typeof index.name === 'string' && index.name.length > 0 && index.name !== '$primary' && !indexes.has(index.name) &&
                Array.isArray(index.keyPaths) && index.keyPaths.length > 0 && index.keyPaths.every(validPath) && typeof index.unique === 'boolean','invalid index definition');
            indexes.add(index.name);
        }
    }
    return registry;
}

// Legacy builds did not save their registry; these exact snapshots bootstrap them.
// Later builds save the full registry in SQLite and derive additive upgrades.
export function validateRegistryCompatibility(currentBytes,catalog,snapshots) {
    const currentHash=hash(currentBytes),current=registryJson(currentBytes);
    requireKeys(catalog,['format','registries'],'catalog');
    requireCompatibility(catalog.format === 1 && Array.isArray(catalog.registries) && catalog.registries.length > 0,'invalid registry history catalog');
    const hashes=new Set(),files=new Set(),releases=new Set();
    for (const entry of catalog.registries) {
        requireKeys(entry,['file','sha256','releases'],'catalog entry');
        requireCompatibility(typeof entry.file === 'string' && /^desktop-v\d+\.\d+\.\d+\.json$/.test(entry.file),'invalid snapshot filename');
        requireCompatibility(!files.has(entry.file) && !hashes.has(entry.sha256),'duplicate registry identity');
        files.add(entry.file);hashes.add(entry.sha256);
        const bytes=snapshots[entry.file];
        requireCompatibility(bytes !== undefined && hash(bytes) === entry.sha256,`historical snapshot checksum mismatch: ${entry.file}`);
        requireCompatibility(Array.isArray(entry.releases) && entry.releases.length > 0,'snapshot must identify its releases');
        for (const release of entry.releases) {
            requireCompatibility(typeof release === 'string' && /^desktop-v\d+\.\d+\.\d+$/.test(release) && !releases.has(release),'invalid or duplicate release identity');
            releases.add(release);
        }
        const source=registryJson(bytes);
        for (const [name,definition] of Object.entries(source.tables)) {
            requireCompatibility(isDeepStrictEqual(definition,current.tables[name]),`released table definition changed: ${entry.file}:${name}; requires an explicit data migration`);
        }
    }
    requireCompatibility(isDeepStrictEqual(Object.keys(snapshots).sort(),[...files].sort()),'snapshot/catalog closure mismatch');
    return {target:currentHash,releases:[...releases].sort(),registries:catalog.registries.length};
}

export async function checkRegistryCompatibility(sourceRoot=root) {
    const catalog=parseJson(await readFile(resolve(sourceRoot,history,'catalog.json'),'utf8'));
    requireCompatibility(Array.isArray(catalog.registries),'invalid registry history catalog');
    const files=(await readdir(resolve(sourceRoot,history))).filter(file=>file !== 'catalog.json');
    const snapshots=Object.fromEntries(await Promise.all(files.map(async file=> {
        requireCompatibility(typeof file === 'string' && /^desktop-v\d+\.\d+\.\d+\.json$/.test(file),'invalid snapshot filename');
        return [file,await readFile(resolve(sourceRoot,history,file))];
    })));
    return validateRegistryCompatibility(await readFile(resolve(sourceRoot,'packages/studio/src/platform/storage/schema.json')),catalog,snapshots);
}
