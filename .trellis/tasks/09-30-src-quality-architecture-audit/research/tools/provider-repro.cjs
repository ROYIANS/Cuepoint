const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const ts=require(path.join(process.cwd(),'node_modules/typescript'));
const cache=new Map();
const stubs={
 'src/lib/ai/modelMetadata.ts':{parseModelMetadata:()=>undefined,collectModelMetadata:()=>({})},
 'src/lib/ai/referenceWire.ts':{materializeResponseItems:async items=>items},
 'src/lib/ai/reasoningPolicy.ts':{assertReasoningEffort:()=>{}}
};
function load(file){
 if(stubs[file])return stubs[file];if(cache.has(file))return cache.get(file).exports;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(file,module);
 const requireLocal=specifier=>{
  const base=specifier.startsWith('@/')?'src/'+specifier.slice(2):specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)):null;
  if(!base)throw new Error('Unexpected external dependency: '+specifier);
  const resolved=[base,base+'.ts',base+'/index.ts'].find(p=>fs.existsSync(p));if(!resolved)throw new Error('Unresolved '+specifier);return load(resolved);
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:requireLocal,Response,Request,Headers,ReadableStream,Blob,TextDecoder,TextEncoder,AbortController,Date,JSON,URL,setTimeout,clearTimeout,DOMException,console},{filename:file});return module.exports;
}
(async()=>{
 const compat=load('src/lib/ai/openaiCompatible.ts'),responses=load('src/lib/ai/responsesStream.ts');
 const input={baseUrl:'https://fixture.invalid/v1',apiKey:'sk-audit-fixture',model:'fixture',connectorDefinitionId:'openai-compatible',messages:[{role:'user',content:'hello'}]};
 const fetchResponse=async()=>new Response(JSON.stringify({status:'failed invalid key sk-audit-fixture',error:{message:'invalid key sk-audit-fixture'}}),{headers:{'content-type':'application/json'}});
 const responseResult=await responses.streamResponses(input,{fetchImpl:fetchResponse});
 const fetchHtml=async()=>new Response('<html>Proxy login required</html>',{headers:{'content-type':'text/html'}});
 const discovery=await compat.listModels(input,fetchHtml),probe=await compat.testConnection(input,fetchHtml);
 const checks={responseMessageRedacted:!responseResult.message?.includes(input.apiKey),responseFinishReasonLeaksFixtureKey:responseResult.finishReason?.includes(input.apiKey)===true,invalidHtmlDiscoveryAccepted:discovery.ok===true,invalidHtmlProbeAccepted:probe.ok===true};
 const output={method:'Original source transpiled in memory; no live network/DB. Metadata, references and reasoning helpers stubbed because absent in these fixtures; no assertion about full integration.',checks,responseResult,discovery,probe};
 const dest='.trellis/tasks/09-30-src-quality-architecture-audit/research/tools/provider-repro-results.json';fs.writeFileSync(dest,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
 if(!Object.values(checks).every(Boolean))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
