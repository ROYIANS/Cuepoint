import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const [beforeBuild,afterBuild,beforeBrowser,afterBrowser,output]=process.argv.slice(2).map(p=>path.resolve(p));
if(!output)throw Error('Usage: node scripts/e06-compare.mjs BEFORE_BUILD AFTER_BUILD BEFORE_BROWSER AFTER_BROWSER NEW_OUTPUT_DIRECTORY');await mkdir(output);
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
function tokens(body){const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,body);const result=[];let kind;while((kind=scanner.scan())!==ts.SyntaxKind.EndOfFileToken)result.push([kind,scanner.getTokenText()]);return result;}
const pairs={};
for(const [name,build,browser] of [['before',beforeBuild,beforeBrowser],['after',afterBuild,afterBrowser]]){
 const assets=await json(path.join(build,'assets.json')),graph=await json(path.join(build,'graph.json')),scenarioResults=[];
 for(const scenario of ['empty','selected','plain','code']){
  const r=await json(path.join(browser,scenario+'.json'));
  for(const a of r.appAssets){assert.equal(a.sha256,assets[a.path.slice(1)].sha256,'Served body equals emitted asset');assert.equal(a.bytes,assets[a.path.slice(1)].bytes);}
  const requested=new Set(r.appAssets.map(a=>a.path.slice(1)));
  const groups=graph.chunks.filter(c=>requested.has(c.fileName)).map(c=>({fileName:c.fileName,bodyBytes:assets[c.fileName].bytes,gzipBytes:assets[c.fileName].gzipBytes,moduleRenderedBytes:Object.values(c.modules).reduce((n,m)=>n+m.renderedLength,0),iconModules:Object.entries(c.modules).filter(([id,m])=>id.includes('@lobehub/icons/')&&m.renderedLength>0).map(([id,m])=>({id,renderedLength:m.renderedLength})),richModules:Object.entries(c.modules).filter(([id,m])=>/shiki|useHighlight|\/Markdown\//.test(id)&&m.renderedLength>0).map(([id,m])=>({id,renderedLength:m.renderedLength}))}));
  scenarioResults.push({scenario,uniqueJS:r.uniqueJS,uniqueCSS:r.uniqueCSS,assetCount:r.appAssets.length,external:r.external,groups,phases:[...new Set(r.appAssets.map(a=>a.phase))].map(phase=>({phase,uniqueBodyBytes:r.appAssets.filter(a=>a.phase===phase).reduce((n,a)=>n+a.bytes,0)}))});
 }
 const beforeRoute=await readFile(path.join(build,'routeTree-before.ts'),'utf8'),builtRoute=await readFile(path.join(build,'routeTree-built.ts'),'utf8');
 assert.deepEqual(tokens(beforeRoute),tokens(builtRoute),'Generated route token equivalence');
 const opening=await json(path.join(build,'inputs-before.json')),effective=await json(path.join(build,'inputs-after.json')),restored=await json(path.join(build,'inputs-restored.json'));
 assert.deepEqual(opening,restored,'Exact source restored after generated-route build');
 assert(Object.keys(opening).filter(p=>opening[p].sha256!==effective[p].sha256).every(p=>p==='src/routeTree.gen.ts'));
 pairs[name]={build,browser,buildResult:await json(path.join(build,'result.json')),networkResult:await json(path.join(browser,'result.json')),scenarios:scenarioResults,route:{before:hash(beforeRoute),effective:hash(builtRoute),tokensEquivalent:true,restored:true},producer:{build:opening['scripts/e06-build.mjs'],browser:await json(path.join(browser,'producer.json'))},moduleInputCount:Object.keys(await json(path.join(build,'module-inputs.json'))).length};
}
assert.equal(pairs.before.producer.build.sha256,pairs.after.producer.build.sha256);
assert.equal(pairs.before.producer.browser.script,pairs.after.producer.browser.script);assert.equal(pairs.before.producer.browser.seed,pairs.after.producer.browser.seed);
const metrics=pairs.before.scenarios.map((b,i)=>{const a=pairs.after.scenarios[i];return {scenario:b.scenario,beforeJS:b.uniqueJS,afterJS:a.uniqueJS,deltaJS:a.uniqueJS-b.uniqueJS,beforeCSS:b.uniqueCSS,afterCSS:a.uniqueCSS,deltaCSS:a.uniqueCSS-b.uniqueCSS};});
await writeFile(path.join(output,'comparison.json'),JSON.stringify({status:'PASS',metrics,pairs,conditions:'Same frozen producer/seed, actual Vite plugins and root entry, isolated original/current source assemblies, identical scripts/tests discovery inputs, identical cache/font/network handling. Unique decoded JS/CSS body bytes, gzip emitted estimates separately. Selected includes real picker loading. Shared and exclusive asset sets preserved in each network result; never summed scenario totals as a union.',limits:'Single native sample per scenario, no timing/latency conclusion. Module rendered lengths locate contributions and are not minified chunk allocations. Browser bodies verified against built assets. Rich highlighter behavior is retained and its measured plain-history cost remains.'},null,2));console.log({status:'PASS',metrics});
