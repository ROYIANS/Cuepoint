const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.cwd(), 'node_modules/typescript'));
const task = '.trellis/tasks/09-30-src-quality-architecture-audit/research';
const manifest = JSON.parse(fs.readFileSync(`${task}/source-manifest.json`, 'utf8'));
const files = Object.values(manifest.groups).flat().map(f => f.path).filter(f => /\.(ts|tsx)$/.test(f));
const known = new Set(files), edges = [], metrics = [], parseErrors = [];
function resolve(from, spec) {
 const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)) : null;
 return base && [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.json`].find(f => known.has(f) || (f.endsWith('.json') && fs.existsSync(f)));
}
for (const file of files) {
 const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
 parseErrors.push(...ast.parseDiagnostics.map(d => ({file, offset:d.start, message:ts.flattenDiagnosticMessageText(d.messageText,' ')})));
 const m = {file, lines:text.split('\n').length, functions:0, anyKeywords:[], typeAssertions:[], nonNullAssertions:[], nestedTernaries:[], emptyCatches:[], dynamicImports:[]};
 function location(node) {return ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;}
 function edge(node, spec, typeOnly, kind) {const target = resolve(file,spec); edges.push({from:file,to:target || spec,internal:!!target,typeOnly,kind,line:location(node)});}
 function walk(node) {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
   const c = node.importClause;
   const typeOnly = !!c && (c.isTypeOnly || (!c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every(e => e.isTypeOnly)));
   edge(node,node.moduleSpecifier.text,typeOnly,'static-import');
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) edge(node,node.moduleSpecifier.text,node.isTypeOnly,'re-export');
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
   const argument = node.arguments[0]; m.dynamicImports.push({line:location(node),literal:argument && ts.isStringLiteral(argument) ? argument.text : null});
   if (argument && ts.isStringLiteral(argument)) edge(node,argument.text,false,'dynamic-import');
  }
  if (ts.isFunctionDeclaration(node)||ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isMethodDeclaration(node)) m.functions++;
  if (node.kind===ts.SyntaxKind.AnyKeyword) m.anyKeywords.push(location(node));
  if (ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)) m.typeAssertions.push(location(node));
  if (ts.isNonNullExpression(node)) m.nonNullAssertions.push(location(node));
  if (ts.isConditionalExpression(node)) {
   function containsConditional(n) {if(ts.isConditionalExpression(n))return true; return ts.forEachChild(n,containsConditional)||false;}
   if (containsConditional(node.whenTrue)||containsConditional(node.whenFalse)) m.nestedTernaries.push(location(node));
  }
  if (ts.isCatchClause(node)&&node.block.statements.length===0) m.emptyCatches.push(location(node));
  ts.forEachChild(node,walk);
 }
 walk(ast); metrics.push(m);
}
function scc(includeTypes,includeDynamic) {
 const graph=new Map(files.map(f=>[f,[]]));
 for(const e of edges)if(e.internal&&graph.has(e.to)&&(includeTypes||!e.typeOnly)&&(includeDynamic||e.kind!=='dynamic-import'))graph.get(e.from).push(e.to);
 let i=0;const index=new Map(),low=new Map(),stack=[],on=new Set(),components=[];
 function visit(v){index.set(v,i);low.set(v,i++);stack.push(v);on.add(v);for(const w of graph.get(v)){if(!index.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(on.has(w))low.set(v,Math.min(low.get(v),index.get(w)));}if(low.get(v)===index.get(v)){let w,c=[];do{w=stack.pop();on.delete(w);c.push(w);}while(w!==v);if(c.length>1)components.push(c.sort());}}
 for(const f of files)if(!index.has(f))visit(f);
 return components;
}
function dir(f){const p=f.split('/');return p.length>3?p.slice(0,3).join('/'):p.slice(0,2).join('/');}
const directoryEdges={};for(const e of edges)if(e.internal){const a=dir(e.from),b=dir(e.to);if(a!==b){const key=`${a} -> ${b}`;const c=directoryEdges[key]||{value:0,typeOnly:0};c[e.typeOnly?'typeOnly':'value']++;directoryEdges[key]=c;}}
const output={baseRevision:manifest.baseRevision,method:'TypeScript AST: imports/reexports/literal dynamic imports; no runtime computed resolution; syntactic signals require review',fileCount:files.length,parseErrors,edges,metrics,staticValueCycles:scc(false,false),valueCyclesIncludingDynamic:scc(false,true),cyclesIncludingTypes:scc(true,true),directoryEdges};
fs.writeFileSync(`${task}/tools/ast-results.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({files:files.length,edges:edges.length,parseErrors:parseErrors.length,staticValueCycles:output.staticValueCycles,totals:metrics.reduce((a,m)=>{for(const k of ['anyKeywords','typeAssertions','nonNullAssertions','nestedTernaries','emptyCatches','dynamicImports'])a[k]=(a[k]||0)+m[k].length;return a;},{})},null,2));
