import { ESLint } from 'eslint';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareExact, exactKeys, IDENTITY_VERSION, readOptional, relative, validateReview } from './shared.mjs';
import { describeDiagnostic, identityProducer } from './identity.mjs';

export async function checkLint(root) {
  const producer = await identityProducer();
  const document = await readOptional(path.join(root, 'quality/debt.json'), { schemaVersion: 1, identityVersion: IDENTITY_VERSION, identityProducer: producer, allowances: [] });
  exactKeys(document, ['schemaVersion', 'identityVersion', 'identityProducer', 'allowances'], 'debt');
  if (document.schemaVersion !== 1 || document.identityVersion !== IDENTITY_VERSION || !Array.isArray(document.allowances)) throw new Error('debt: unsupported schema/identity version');
  exactKeys(document.identityProducer, ['sha256', 'typescript'], 'debt identity producer');
  if (document.identityProducer.sha256 !== producer.sha256 || document.identityProducer.typescript !== producer.typescript) throw new Error('debt: identity producer or TypeScript version changed; explicit review required');
  for (const row of document.allowances) {
    exactKeys(row, ['rule', 'file', 'signature', 'count', 'reason', 'owner'], 'debt allowance');
    validateReview(row, 'debt allowance');
    if (typeof row.rule !== 'string' || !row.rule.trim() || !/^[a-f0-9]{64}$/.test(row.signature)) throw new Error('debt allowance: invalid rule/signature');
  }
  const eslint = new ESLint({ cwd: root, overrideConfigFile: path.join(root, 'eslint.config.mjs'), allowInlineConfig: false });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  const diagnostics = [];
  for (const result of results) {
    const file = relative(root, result.filePath);
    const text = result.source ?? await readFile(result.filePath, 'utf8');
    for (const message of result.messages) diagnostics.push({ file, rule: message.ruleId ?? '<parser>', severity: message.severity, message: message.message, line: message.line, column: message.column, endLine: message.endLine, endColumn: message.endColumn, ...(message.severity === 2 ? describeDiagnostic(file, text, message) : {}) });
  }
  const errors = diagnostics.filter(row => row.severity === 2);
  const failures = compareExact(errors, document.allowances, row => JSON.stringify([row.rule, row.file, row.signature]), 'debt');
  // An unanchorable parser/fatal diagnostic is never eligible for allowances.
  for (const row of errors.filter(row => !row.signature)) failures.push({ kind: 'unanchorable-diagnostic', file: row.file, rule: row.rule, message: row.message });
  const warningCounts = {};
  for (const row of diagnostics.filter(row => row.severity === 1)) warningCounts[row.rule] = (warningCounts[row.rule] ?? 0) + 1;
  return { checkedFiles: results.map(row => relative(root, row.filePath)).sort(), identityProducer: producer, inlineConfig: 'disabled: root configuration is authoritative', errors: errors.length, warnings: diagnostics.length - errors.length, warningCounts, allowances: document.allowances, diagnostics, failures };
}
