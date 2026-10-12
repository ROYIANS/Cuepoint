import base from "/Users/xiaomengdao/WebstormProjects/aifenjing/vitest.config.ts";
import {defineConfig} from "vitest/config";
const mark = label => `(globalThis as any).__mimoProfileMark(${JSON.stringify(label)});`;
function replaceOnce(code, from, to) {if (code.split(from).length !== 2) throw new Error(`Expected single profile location: ${from}`); return code.replace(from,to);}
export default defineConfig({...base, plugins:[{
 name:"finite-mimo-production-profile", enforce:"pre", transform(code,id) {
  if (id.endsWith("/src/lib/ai/mimoSpeech.ts")) {
   code=replaceOnce(code,"    let text: string;",mark("response-read-start")+"\n    let text: string;");
   code=replaceOnce(code,"        data = JSON.parse(text);","        data = JSON.parse(text);"+mark("JSON.parse"));
   code=replaceOnce(code,"    const message = choice.message, encoded = choice.message.audio.data;",mark("base64-syntax-start")+"\n    const message = choice.message, encoded = choice.message.audio.data;");
   code=replaceOnce(code,"    let padding = 0;",mark("base64-syntax-regex")+"\n    let padding = 0;");
   code=replaceOnce(code,"        const decoded = atob(encoded), bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));",mark("exact-size-check")+"\n const decoded = atob(encoded);"+mark("atob")+"\n const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));"+mark("Uint8Array.from-decoded-string"));
   code=replaceOnce(code,'        const blob = new Blob([bytes], {type: "audio/wav"});','        const blob = new Blob([bytes], {type: "audio/wav"});'+mark("Blob-copy"));
   code=replaceOnce(code,'        const preview = message.final_text_preview;',mark("MIME-signature")+'\n        const preview = message.final_text_preview;');
   return {code,map:null};
  }
  if (id.endsWith("/src/lib/ai/boundedResponse.ts")) {
   code=replaceOnce(code,"        const bytes = new Uint8Array(size);",mark("response-stream-read")+"\n        const bytes = new Uint8Array(size);");
   code=replaceOnce(code,"        return bytes;",mark("response-byte-assembly")+"\n        return bytes;");
   code=replaceOnce(code,'    return new TextDecoder("utf-8", {fatal}).decode(await readResponseBytes(response, limit, signal));','    const result = new TextDecoder("utf-8", {fatal}).decode(await readResponseBytes(response, limit, signal));'+mark("TextDecoder")+'\n    return result;');
   return {code,map:null};
  }
  if (id.endsWith("/tests/boundedInput.test.ts")) {
   const start='    it("accepts a legitimate MiMo envelope above 4 MiB and exactly the decoded audio boundary", async () => {';
   code=replaceOnce(code,start,start+`\n (globalThis as any).__mimoProfileRecords=[]; (globalThis as any).__mimoLast={now:performance.now(),cpu:process.cpuUsage(),memory:process.memoryUsage()};`);
   code=replaceOnce(code,'        const encoded = Buffer.from(bytes).toString("base64");','        const encoded = Buffer.from(bytes).toString("base64");'+mark("fixture-32MiB-allocation-base64"));
   const begin=code.indexOf(start),end=code.indexOf('    it("allows protected AIHubMix',begin);
   let fixture=code.slice(begin,end);
   fixture=replaceOnce(fixture,'async () => Response.json({choices: [{finish_reason: "stop", message: {audio: {data: encoded}}}]}));','async () => {const response = Response.json({choices: [{finish_reason: "stop", message: {audio: {data: encoded}}}]});'+mark("Response.json-stringify-encode")+'return response;});');
   fixture=replaceOnce(fixture,'        expect(fetchImpl).toHaveBeenCalledOnce();','        expect(fetchImpl).toHaveBeenCalledOnce();'+mark("original-assertions")+'\n console.log("MIMO_PROFILE_JSON " + JSON.stringify((globalThis as any).__mimoProfileRecords));');
   code=code.slice(0,begin)+fixture+code.slice(end);
   const helper=`\n(globalThis as any).__mimoProfileMark = (label: string) => {const previous=(globalThis as any).__mimoLast;const current={now:performance.now(),cpu:process.cpuUsage(),memory:process.memoryUsage()};(globalThis as any).__mimoProfileRecords.push({label,ms:current.now-previous.now,cpuMicroseconds:{user:current.cpu.user-previous.cpu.user,system:current.cpu.system-previous.cpu.system},memory:current.memory,memoryDelta:Object.fromEntries(Object.keys(current.memory).map(key=>[key,current.memory[key]-previous.memory[key]]))});(globalThis as any).__mimoLast=current;};\n`;
   return {code:helper+code,map:null};
  }
 }},...(base.plugins??[])]});
