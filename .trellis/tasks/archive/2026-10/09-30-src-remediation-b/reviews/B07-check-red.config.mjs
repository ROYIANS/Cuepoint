import {readFileSync} from "node:fs";
export default {
  root: "/Users/xiaomengdao/WebstormProjects/aifenjing",
  resolve: {alias: {"@": "/Users/xiaomengdao/WebstormProjects/aifenjing/src"}},
  plugins: [{name: "b07-original-source", enforce: "pre", transform(source, id) {
    if (/\/components\/agent\/(AgentChatPage.tsx|useReferenceDraft.ts)$/.test(id)) {
      return readFileSync("/tmp/b07-baseline-source/" + id.split("/").at(-1), "utf8");
    }
    return source;
  }}],
  test: {include: ["tests/**/*.test.ts"], setupFiles: ["./tests/setup.ts"], clearMocks: true}
};
