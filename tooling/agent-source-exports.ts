import {fileURLToPath} from "node:url";

// Only explicitly selected source-validation profiles may use these mappings.
// Normal consumers retain the emitted exports and their freshness checks.
export function createAgentSourceAliases() {
    return [
        {find: /^@cuepoint\/agent-core$/, replacement: fileURLToPath(new URL("../packages/agent-core/src/index.ts", import.meta.url))},
        {find: /^@cuepoint\/agent-providers$/, replacement: fileURLToPath(new URL("../packages/agent-providers/src/index.ts", import.meta.url))},
        {find: /^@cuepoint\/agent-providers\/http$/, replacement: fileURLToPath(new URL("../packages/agent-providers/src/http/index.ts", import.meta.url))},
    ];
}
