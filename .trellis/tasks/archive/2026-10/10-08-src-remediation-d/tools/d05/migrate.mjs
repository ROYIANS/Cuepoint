import ts from '/Users/xiaomengdao/WebstormProjects/aifenjing/node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
const files=['tools','libraryToolHelpers','taskTools','memoryTools','referenceTools','materialTools','audioGenerationTools','generationTools','toolLoading','businessTools'];
for(const file of files){
 const path=`src/lib/agent/${file}.ts`; let text=fs.readFileSync(path,'utf8'); const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true); let changes=[];
 function visit(n){
  if(ts.isObjectLiteralExpression(n)){
   const props=n.properties; const parser=props.find(p=>p.name?.getText(source)==='parseArguments');const parameters=props.find(p=>p.name?.getText(source)==='parameters');
   if(parser&&parameters){
    const body=parser.initializer.body;
    if(!ts.isCallExpression(body)||!ts.isPropertyAccessExpression(body.expression)||body.expression.name.text!=='parse')throw new Error(`${file}: parser not simple`);
    const schema=body.expression.expression.getText(source); const json=parameters.initializer.getText(source);
    const kept=props.filter(p=>p!==parser&&p!==parameters).map(p=>p.getText(source)).join(',\n');
    changes.push([n.getStart(source),n.end,`defineTool({schema: ${schema}, json: ${json}}, {\n${kept}\n})`]);return;
   }
  }ts.forEachChild(n,visit);
 }visit(source);
 for(const [start,end,value]of changes.sort((a,b)=>b[0]-a[0]))text=text.slice(0,start)+value+text.slice(end);
 text=`import {defineTool} from './toolDefinition';\n`+text;
 text=text.replace(/: readonly AgentToolDefinition\[\]/g,'');
 fs.writeFileSync(path,text);
 console.log(file,changes.length);
}
