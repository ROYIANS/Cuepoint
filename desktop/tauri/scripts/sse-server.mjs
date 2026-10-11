import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function reserveStreamServer(root,token) {
    const events=[];
    const record=event=>{events.push({...event,atMs:Date.now()});};
    const persist=()=>writeFile(resolve(root,'server-events.json'),JSON.stringify(events,null,2)+'\n');
    const server=createServer(async(request,response)=>{
        const origin=request.headers.origin;
        record({type:'request',method:request.method,url:request.url,origin:origin??null});
        if(origin!=='tauri://localhost') {response.writeHead(403);response.end('Packaged Origin mismatch');await persist();return;}
        response.setHeader('Access-Control-Allow-Origin',origin);
        response.setHeader('Vary','Origin');
        response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
        if(request.method==='OPTIONS'){response.writeHead(204);response.end();await persist();return;}
        if(request.headers.authorization!==`Bearer ${token}`){response.writeHead(401);response.end('Fixture token required');await persist();return;}
        const url=new URL(request.url??'/', 'http://127.0.0.1');
        let body='';
        for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>65536){response.writeHead(413);response.end();await persist();return;}}
        let model='success';
        if(body){try{const value=JSON.parse(body);if(typeof value.model==='string')model=value.model;}catch{response.writeHead(400);response.end();await persist();return;}}
        const mode=url.searchParams.get('case')??model;
        const responses=url.pathname==='/v1/responses';
        const raw=url.pathname==='/v1/events';
        if(!responses&&!raw&&url.pathname!=='/v1/chat/completions'){response.writeHead(404);response.end();await persist();return;}
        response.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
        response.flushHeaders();
        let finished=false;
        const timers=new Set();
        response.once('close',()=>{for(const timer of timers)clearTimeout(timer);record({type:'disconnect',mode,path:url.pathname,finished});void persist();});
        const write=(text,label)=>{if(response.destroyed)return;response.write(text);record({type:'chunk',mode,label,bytes:Buffer.byteLength(text)});};
        const later=(ms,fn)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);};
        const event=(data,name='')=>`${name?`event: ${name}\r\n`:''}data: ${JSON.stringify(data)}\r\n\r\n`;
        const chat=content=>({choices:[{delta:{content},finish_reason:null}]});
        if(mode==='event-overflow'){later(80,()=>write('data: '+ 'x'.repeat(4*1024*1024+128)+'\r\n\r\n','oversized-event'));later(900,()=>{finished=true;response.end();});return;}
        if(raw){
            if(mode==='multibyte') {
                const bytes=Buffer.from('data: 雨🌹\r\n\r\n');const split=10;
                later(80,()=>{response.write(bytes.subarray(0,split));record({type:'chunk',mode,label:'partial-utf8',bytes:split});});
                later(280,()=>{response.write(bytes.subarray(split));record({type:'chunk',mode,label:'utf8-rest',bytes:bytes.length-split});});
            } else {
                later(80,()=>write(': comment\r\nevent: fixture\r\ndata: first\r','crlf-before-lf'));
                later(280,()=>write('\ndata: second\r\n\r','crlf-second-before-lf'));
                later(450,()=>write('\n','crlf-final-lf'));
            }
            later(mode==='abort'?5000:700,()=>{finished=true;response.end();});return;
        }
        if(mode==='output-overflow') {
            const piece='雨'.repeat(200000);
            for(let i=0;i<9;i++)later(80+i*50,()=>write(event(responses?{type:'response.output_text.delta',delta:piece}:chat(piece),responses?'response.output_text.delta':''),'output-budget'));
            later(1000,()=>{finished=true;response.end();});return;
        }
        later(100,()=>write(event(responses?{type:'response.output_text.delta',delta:'雨'}:chat('雨'),responses?'response.output_text.delta':''),'first-delta'));
        later(350,()=>write(event(responses?{type:'response.output_text.delta',delta:'🌹'}:chat('🌹'),responses?'response.output_text.delta':''),'second-delta'));
        later(mode==='abort'?5000:850,()=>{
            if(mode==='terminal-error')write(event(responses?{type:'response.failed',response:{status:'failed',error:{message:'fixture terminal failure'},output:[]}}:{error:{message:'fixture terminal failure'}},responses?'response.failed':'error'),'terminal-error');
            else if(responses)write(event({type:'response.completed',response:{id:'fixture',status:'completed',output:[{id:'message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'雨🌹',annotations:[]}]}],usage:{input_tokens:1,output_tokens:2,total_tokens:3}}},'response.completed'),'terminal');
            else {write(event({choices:[{delta:{},finish_reason:'stop'}]}),'finish');write('data: [DONE]\r\n\r\n','terminal');}
            finished=true;response.end();void persist();
        });
    });
    await new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
    const address=server.address();if(!address||typeof address==='string')throw new Error('Ephemeral loopback reservation failed');
    return {endpoint:`http://127.0.0.1:${address.port}/v1`,events,close:async()=>{server.closeAllConnections();await new Promise(accept=>server.close(accept));await persist();}};
}
