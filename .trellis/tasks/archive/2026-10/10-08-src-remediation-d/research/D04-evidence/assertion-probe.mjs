import ts from 'typescript';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root = '.trellis/tasks/10-08-src-remediation-d/research/D04-evidence';
const before = JSON.parse(fs.readFileSync(root + '/before.json', 'utf8'));
function inspect(path, source) {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const assertions = [], satisfies = [];
    function visit(node) {
        const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) assertions.push({line, type: node.type.getText(tree), expression: node.expression.getText(tree), syntax: node.getText(tree)});
        if (ts.isSatisfiesExpression(node)) satisfies.push({line, type: node.type.getText(tree), syntax: node.getText(tree)});
        ts.forEachChild(node, visit);
    }
    visit(tree);
    return {assertions, satisfies};
}
const files = Object.keys(before.scope).filter(path => path.startsWith('src/'));
const results = files.map(path => ({path, before: before.scope[path] ? inspect(path, fs.readFileSync(root + '/before/' + path, 'utf8')) : {assertions: [], satisfies: []}, after: inspect(path, fs.readFileSync(path, 'utf8'))}));
const added = results.flatMap(row => {
    const prior = [...row.before.assertions];
    return row.after.assertions.filter(item => {
        const i = prior.findIndex(old => old.syntax === item.syntax);
        if (i < 0) return true;
        prior.splice(i, 1); return false;
    }).map(item => ({path: row.path, ...item}));
});
if (added.length !== 7 || added.some(item => item.type !== 'const')) throw new Error('Unexpected assertion delta');
const proof = {addedCount: added.length, allAddedAreConstLiteralOrObjectInference: true, added, checkedSatisfies: results.flatMap(row => row.after.satisfies.map(item => ({path: row.path, ...item}))), results, sourceHashes: Object.fromEntries(files.map(path => [path, crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')]))};
fs.writeFileSync(root + '/literal-assertions.json', JSON.stringify(proof, null, 2) + '\n');
console.log(`${added.length} added assertions: all const inference; ${proof.checkedSatisfies.length} checked satisfies envelopes; no unchecked payload casts`);
