import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, cpSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'vendor/lobehub');
const snapshot = join(vendor, 'model-bank');
const generated = join(root, 'src/lib/ai/modelBank');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function inventory(dir) {
  const result = {};
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) for (const [child, value] of Object.entries(inventory(path))) result[`${name}/${child}`] = value;
    else result[name] = hash(readFileSync(path));
  }
  return result;
}
function differences(expected, actual) {
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter((key) => expected[key] !== actual[key]);
}
export function verifySnapshot(upstream) {
  const manifest = JSON.parse(readFileSync(join(vendor, 'manifest.json'), 'utf8'));
  const changed = differences(manifest.files, inventory(snapshot));
  if (changed.length) throw new Error(`Snapshot differs from manifest: ${changed.join(', ')}`);
  if (hash(readFileSync(join(vendor, 'LICENSE'))) !== manifest.licenseSha256) throw new Error('License checksum mismatch');
  if (upstream) {
    const mismatches = differences(manifest.files, inventory(join(upstream, 'packages/model-bank')));
    if (mismatches.length) throw new Error(`Upstream differs: ${mismatches.join(', ')}`);
    if (hash(readFileSync(join(upstream, 'LICENSE'))) !== manifest.licenseSha256) throw new Error('Upstream license differs');
  }
  return manifest;
}

// Compile the trusted vendored data modules in a restricted VM. No fs/network/process
// is exposed to them; only local snapshot modules and the installed zod are allowed.
function moduleLoader(packagePath) {
  const cache = new Map();
  const require = createRequire(import.meta.url);
  function load(path) {
    path = resolve(path);
    if (!path.startsWith(`${packagePath}/`)) throw new Error(`External module refused: ${path}`);
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.ts');
    if (!existsSync(path)) path = existsSync(`${path}.ts`) ? `${path}.ts` : join(path, 'index.ts');
    if (cache.has(path)) return cache.get(path).exports;
    const source = readFileSync(path, 'utf8');
    const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const module = { exports: {} };
    cache.set(path, module);
    const context = vm.createContext({ module, exports: module.exports, require: (specifier) => {
      if (specifier === 'zod') return require('zod');
      if (!specifier.startsWith('.')) throw new Error(`External dependency refused: ${specifier}`);
      return load(resolve(dirname(path), specifier));
    } });
    new vm.Script(result.outputText, { filename: path }).runInContext(context, { timeout: 10000 });
    return module.exports;
  }
  return load;
}
export function deriveDataset(packagePath = snapshot) {
  const load = moduleLoader(packagePath);
  const indexPath = join(packagePath, 'src/aiModels/index.ts');
  const ast = ts.createSourceFile(indexPath, readFileSync(indexPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const providers = {};
  const sources = {};
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('./')) continue;
    const binding = statement.importClause.name?.text ?? statement.importClause.namedBindings?.elements?.find((item) => item.propertyName?.text === 'default')?.name.text;
    if (!binding) continue;
    const models = load(resolve(dirname(indexPath), specifier)).default;
    if (!Array.isArray(models)) throw new Error(`Provider ${binding} has no model array`);
    providers[binding] = models;
    sources[binding] = `packages/model-bank/src/aiModels/${specifier.slice(2)}.ts`;
  }
  // Fail instead of silently dropping function/undefined/non-finite data in JSON.
  const text = JSON.stringify(providers, (_key, value) => {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-JSON model data encountered');
    return value;
  }, 2) + '\n';
  const data = JSON.parse(text);
  const lookup = {};
  for (const [provider, models] of Object.entries(data)) {
    lookup[provider] = models.map((model) => ({ id: model.id, ...('contextWindowTokens' in model ? { contextWindowTokens: model.contextWindowTokens } : {}), ...('maxOutput' in model ? { maxOutput: model.maxOutput } : {}) }));
  }
  return { text, lookup: JSON.stringify({ sources, providers: lookup }, null, 2) + '\n', providers: Object.keys(data).length, models: Object.values(data).reduce((n, models) => n + models.length, 0) };
}
function main() {
  const [mode, upstream] = process.argv.slice(2);
  if (!['verify', 'generate', 'sync'].includes(mode)) throw new Error('Usage: model-bank-snapshot.mjs verify|generate|sync [lobehub-path]');
  if (mode === 'sync') {
    if (!upstream) throw new Error('sync requires local LobeHub checkout');
    const source = resolve(upstream);
    const sourcePackage = join(source, 'packages/model-bank');
    if (sourcePackage === snapshot) throw new Error('Refusing to synchronize snapshot onto itself');
    const files = inventory(sourcePackage);
    // Validate derivation before replacing the existing snapshot.
    deriveDataset(sourcePackage);
    const license = readFileSync(join(source, 'LICENSE'));
    const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    rmSync(snapshot, { recursive: true, force: true });
    cpSync(sourcePackage, snapshot, { recursive: true });
    writeFileSync(join(vendor, 'LICENSE'), license);
    writeFileSync(join(vendor, 'manifest.json'), JSON.stringify({ repository: 'https://github.com/lobehub/lobehub', revision, sourcePath: 'packages/model-bank', copiedAt: new Date().toISOString().slice(0, 10), files, licenseSha256: hash(license) }, null, 2) + '\n');
  }
  const manifest = verifySnapshot(upstream && resolve(upstream));
  const result = deriveDataset();
  for (const [name, text] of [['models.generated.json', result.text], ['lookup.generated.json', result.lookup]]) {
    const path = join(generated, name);
    if (mode === 'verify') {
      if (readFileSync(path, 'utf8') !== text) throw new Error(`Stale generated data: ${relative(root, path)}`);
    } else { mkdirSync(generated, { recursive: true }); writeFileSync(path, text); }
  }
  console.log(JSON.stringify({ files: Object.keys(manifest.files).length, providers: result.providers, models: result.models, revision: manifest.revision, result: 'verified' }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
