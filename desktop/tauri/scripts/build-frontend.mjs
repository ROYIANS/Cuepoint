import {build} from '../../../node_modules/vite/dist/node/index.js';
import react from '../../../node_modules/@vitejs/plugin-react/dist/index.js';
import tailwind from '../../../node_modules/@tailwindcss/vite/dist/index.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const base=fileURLToPath(new URL('../',import.meta.url));
const projectRoot=resolve(base,'../..');
const acceptance=process.argv.includes('--acceptance');
const endpoint=acceptance ? process.env.CUEPOINT_STREAM_ENDPOINT : '';
const token=acceptance ? process.env.CUEPOINT_STREAM_TOKEN : '';
if(acceptance && (!endpoint || !/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(endpoint) || !token)) throw new Error('Acceptance build requires a reserved exact loopback endpoint and test token');
// The normal bundle is the real product. The historical acceptance harness
// remains a separate fixture so its locked selectors and evidence do not
// silently change when product routes evolve.
const frontendRoot=acceptance ? resolve(base,'ui') : projectRoot;
const frontendAlias=acceptance ? resolve(base,'../../src') : resolve(projectRoot,'src');
await build({configFile:false,root:frontendRoot,plugins:[react(),tailwind()],resolve:{alias:{'@':frontendAlias}},
    define:{__ACCEPTANCE__:JSON.stringify(acceptance),__STREAM_ENDPOINT__:JSON.stringify(endpoint),__STREAM_TOKEN__:JSON.stringify(token)},
    build:{outDir:resolve(base,'dist',acceptance?'acceptance':'normal'),emptyOutDir:true,assetsInlineLimit:0},worker:{format:'es'}});
