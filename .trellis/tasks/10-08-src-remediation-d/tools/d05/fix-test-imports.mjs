import ts from '/Users/xiaomengdao/WebstormProjects/aifenjing/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
for (const name of fs.readdirSync('tests').filter(name => name.endsWith('.test.ts'))) {
    const path = `tests/${name}`;
    let text = fs.readFileSync(path, 'utf8');
    const bindings = [...text.matchAll(/^const \w+ = registeredTools\(\w+\);\n/gm)].map(match => match[0]);
    if (!bindings.length) continue;
    text = text.replace(/^const \w+ = registeredTools\(\w+\);\n/gm, '');
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const imports = source.statements.filter(ts.isImportDeclaration);
    const end = Math.max(...imports.map(node => node.end));
    text = text.slice(0, end) + '\n' + bindings.join('') + text.slice(end);
    fs.writeFileSync(path, text);
}
