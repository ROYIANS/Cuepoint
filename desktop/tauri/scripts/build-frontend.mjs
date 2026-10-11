import {build} from '../../../node_modules/vite/dist/node/index.js';
import react from '../../../node_modules/@vitejs/plugin-react/dist/index.js';
import tailwind from '../../../node_modules/@tailwindcss/vite/dist/index.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const base=fileURLToPath(new URL('../',import.meta.url));
const acceptance=process.argv.includes('--acceptance');
const endpoint=acceptance ? process.env.CUEPOINT_STREAM_ENDPOINT : '';
const token=acceptance ? process.env.CUEPOINT_STREAM_TOKEN : '';
if(acceptance && (!endpoint || !/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(endpoint) || !token)) throw new Error('Acceptance build requires a reserved exact loopback endpoint and test token');
await build({configFile:false,root:resolve(base,'ui'),plugins:[react(),tailwind()],resolve:{alias:{'@':resolve(base,'../../src')}},
    define:{__ACCEPTANCE__:JSON.stringify(acceptance),__STREAM_ENDPOINT__:JSON.stringify(endpoint),__STREAM_TOKEN__:JSON.stringify(token)},
    build:{outDir:resolve(base,'dist',acceptance?'acceptance':'normal'),emptyOutDir:true,assetsInlineLimit:0},worker:{format:'es'}});
