import base from "/Users/xiaomengdao/WebstormProjects/aifenjing/vitest.config";
import {defineConfig} from "vitest/config";
export default defineConfig({...base,test:{...base.test,include:[".trellis/tasks/10-12-desktop-release-pipeline/research/logs/ci-large-identity-timeout/profile.test.ts"],maxWorkers:1}});
