import base from "/Users/xiaomengdao/WebstormProjects/aifenjing/vitest.config";
import {defineConfig} from "vitest/config";
import {resolve,dirname} from "node:path";
const database="/Users/xiaomengdao/WebstormProjects/aifenjing/src/db/database";
export default defineConfig({...base,plugins:[{name:"research-native-query-observation",enforce:"pre",resolveId(source,importer){const target=source.startsWith(".") && importer ? resolve(dirname(importer),source):source;if(source === "@/db/database" || target === database || target === database+".ts")return "/Users/xiaomengdao/WebstormProjects/aifenjing/.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-agent-loop-cost-implementation/candidate/nativeDatabaseProfile.ts";}},...base.plugins ?? []],test:{...base.test,include:[".trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-native-loop-timeout/agentToolsProfile.test.ts"]}});
