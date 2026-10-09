import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const IDENTITY_VERSION = 'ts-ast-tokens-v1';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');
export const inside = file => typeof file === 'string' && file.length > 0 && !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..') && !file.includes('\\');
export const owned = file => file.startsWith('src/') || file.startsWith('scripts/') || file === 'package.json';
export async function filesUnder(root, directory) {
  const result = [];
  async function visit(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) result.push(file);
    }
  }
  await visit(directory);
  return result.sort();
}
export async function readOptional(file, fallback) {
  try {
    const text = await readFile(file, 'utf8');
    const value = JSON.parse(text);
    const syntax = ts.parseJsonText(file, text);
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const keys = new Set();
        for (const property of node.properties) {
          const key = property.name?.text;
          if (keys.has(key)) throw new Error(`${file}: duplicate JSON key ${key}`);
          keys.add(key);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
    return value;
  }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
export function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
    throw new Error(`${label}: expected exactly ${keys.join(', ')}`);
  }
}
export function validateReview(row, label) {
  if (!inside(row.file)) throw new Error(`${label}: invalid relative file`);
  if (!Number.isSafeInteger(row.count) || row.count < 1) throw new Error(`${label}: count must be a positive integer`);
  for (const field of ['reason', 'owner']) {
    if (typeof row[field] !== 'string' || row[field].trim().length < (field === 'reason' ? 12 : 3) || /^(todo|tbd|unknown|n\/a)$/i.test(row[field].trim())) {
      throw new Error(`${label}: concrete ${field} required`);
    }
  }
}
export function compareExact(actual, allowances, keyOf, label) {
  const counts = new Map();
  for (const row of actual) { const key = keyOf(row); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const accepted = new Set();
  const failures = [];
  for (const row of allowances) {
    const key = keyOf(row);
    if (accepted.has(key)) throw new Error(`${label}: duplicate key ${key}`);
    accepted.add(key);
    const count = counts.get(key) ?? 0;
    if (count !== row.count) failures.push({ kind: count === 0 ? 'stale-allowance' : 'allowance-count-mismatch', key, expected: row.count, actual: count });
  }
  for (const [key, count] of counts) if (!accepted.has(key)) failures.push({ kind: 'unallowed', key, count });
  return failures;
}

export async function packageManifest(require, name) {
  let directory = path.dirname(require.resolve(name));
  while (true) {
    try {
      const file = path.join(directory, 'package.json');
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      if (manifest.name === name) return { file, manifest };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot locate manifest for ${name}`);
    directory = parent;
  }
}
