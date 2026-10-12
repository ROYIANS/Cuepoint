import {createHash} from "node:crypto";
const mode=process.argv[2], source=new Uint8Array(32*1024*1024);
for(let i=0;i<source.length;i++) source[i]=i%256;
const decoded=atob(Buffer.from(source).toString("base64"));
const before={memory:process.memoryUsage(),cpu:process.cpuUsage(),now:performance.now()};
let bytes;
if(mode==="original") bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
else if(mode==="indexed") {bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++) bytes[i]=decoded.charCodeAt(i);}
else throw new Error("closed comparison mode");
const after={memory:process.memoryUsage(),cpu:process.cpuUsage(),now:performance.now()};
const hash=value=>createHash("sha256").update(value).digest("hex");
const inputSha256=hash(source),outputSha256=hash(bytes);
const result={mode,node:process.version,platform:process.platform,arch:process.arch,decodedBytes:decoded.length,conversionMs:after.now-before.now,before,after,inputSha256,outputSha256,exactBytes:inputSha256===outputSha256};
console.log(JSON.stringify(result));
if(!result.exactBytes) process.exitCode=1;
