// Local-only acceptance fixture; does not contact or impersonate a live provider.
import {createServer} from 'node:http';
import {readFile, appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const wav = await readFile(new URL('../../09-22-audio-arrangement-experience/acceptance/local-duration-1.wav', import.meta.url));
const logFile = fileURLToPath(new URL('./local-provider-requests.jsonl', import.meta.url));
const counts = new Map();
let active = 0;
let maxActive = 0;
let held;
const writeLog = entry => appendFile(logFile, JSON.stringify({at:new Date().toISOString(),...entry})+'\n');
const server = createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5173');
  res.setHeader('Access-Control-Allow-Headers','authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method==='GET' && req.url==='/v1/models'){res.end(JSON.stringify({data:[{id:'mimo-v2.5-tts'}]}));return;}
  if(req.method==='GET' && req.url==='/fixture/stats'){res.end(JSON.stringify({active,maxActive,counts:Object.fromEntries(counts),held:!!held}));return;}
  const success = () => JSON.stringify({choices:[{finish_reason:'stop',message:{audio:{data:wav.toString('base64')}}}]});
  if(req.method==='POST' && req.url==='/fixture/release'){
    if(held){held.end(success());held=undefined;}
    res.end(JSON.stringify({released:true}));return;
  }
  if(req.method!=='POST' || req.url!=='/v1/chat/completions'){res.writeHead(404);res.end('{}');return;}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000){res.writeHead(413);res.end('{}');return;}}
  let body;try{body=JSON.parse(raw);}catch{res.writeHead(400);res.end('{}');return;}
  const text=body.messages?.find(message=>message.role==='assistant')?.content;
  if(typeof text!=='string'){res.writeHead(400);res.end('{}');return;}
  const attempt=(counts.get(text)||0)+1;counts.set(text,attempt);active++;maxActive=Math.max(maxActive,active);
  await writeLog({event:'received',text,attempt,active,maxActive,model:body.model});
  res.once('close',()=>{active--;void writeLog({event:'closed',text,attempt,active});});
  if(text.startsWith('第十一段：') && attempt===1){held=res;await writeLog({event:'held',text,attempt});return;}
  await new Promise(resolve=>setTimeout(resolve,250));
  if(text.startsWith('第十段：') && attempt===1){res.writeHead(400);res.end(JSON.stringify({error:{message:'Fixture: explicit rejected request, retry requires a new confirmation'}}));return;}
  res.end(success());
});
server.listen(5181,'127.0.0.1',()=>process.stdout.write('Local fixture listening on http://127.0.0.1:5181; no live provider requests\n'));
