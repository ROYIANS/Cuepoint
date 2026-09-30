const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const names = new Set(["patchCharacter", "patchScene", "patchProp", "patchStyle", "patchShot", "patchProjectOutput"]);
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir,e.name)] : []); }
const result=[], references=[];
for (const file of files("src")) {
 const text=fs.readFileSync(file,"utf8"), ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 const imported = new Map(), namespaces = new Map();
 for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) namespaces.set(node.importClause.namedBindings.name.text,node.moduleSpecifier.text);
 for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
  for (const e of node.importClause.namedBindings.elements) if (names.has(e.propertyName?.text ?? e.name.text)) imported.set(e.name.text, {name:e.propertyName?.text ?? e.name.text, from:node.moduleSpecifier.text});
 }
 function visit(n) {
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (imported.has(n.expression.text) || file==="src/db/repo.ts" && names.has(n.expression.text))) {
   const target=imported.get(n.expression.text) ?? {name:n.expression.text,from:"local"};
   result.push({file,line:ast.getLineAndCharacterOfPosition(n.getStart()).line+1,...target,args:n.arguments.map(a=>a.getText(ast))});
  }
  if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && namespaces.has(n.expression.text) && names.has(n.name.text)) {
   const entry={file,line:ast.getLineAndCharacterOfPosition(n.getStart()).line+1,name:n.name.text,from:namespaces.get(n.expression.text)};
   if (ts.isCallExpression(n.parent) && n.parent.expression===n) result.push({...entry,args:n.parent.arguments.map(a=>a.getText(ast)),namespace:true});
   else references.push({...entry,expression:n.getText(ast),context:n.parent.getText(ast).slice(0,500)});
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
}
fs.writeFileSync(".trellis/tasks/09-30-src-remediation-c/research/C05-static-call-sites.json",JSON.stringify({limitation:"Static direct identifier/namespace calls and namespace function references; computed references and payload builders require manual follow-up",calls:result,functionReferences:references},null,2)+"\n");
console.log(JSON.stringify({calls:result.length,references:references.length,byApi:Object.fromEntries([...names].map(n=>[n,result.filter(r=>r.name===n).length]))}));
