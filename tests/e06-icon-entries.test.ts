import {describe, expect, it} from "vitest";
import {readFile} from "node:fs/promises";
import {modelMappings, providerMappings} from "@/components/agent/ModelIconMapping.generated";
// Data generation reads publisher AST without executing its browser UI modules.
// Native parity additionally checks every entry against live publisher exports.
import {catalogData, generatedSource} from "../scripts/e06-icon-data.mjs";

describe("E06 complete publisher matching metadata", () => {
    it("preserves every ordered mapping and mapped prop, and detects stale generation", async () => {
        const data = await catalogData();
        expect(modelMappings).toEqual(data.model);
        expect(providerMappings).toEqual(data.provider);
        expect(await readFile("src/components/agent/ModelIconMapping.generated.ts", "utf8")).toBe(generatedSource(data));
    });
    it("retains regex first-match precedence, mixed case and exact provider matching", () => {
        const model = (name: string) => modelMappings.find(item => item.keywords.some(keyword => new RegExp(keyword, "i").test(name.toLowerCase())));
        const provider = (name: string) => providerMappings.find(item => item.keywords.some(keyword => keyword.toLowerCase() === name.toLowerCase()));
        expect(model("cc-GPT-4o")?.icon).toBe("OpenAI");
        const gpt4 = model("cc-GPT-4o");
        expect(gpt4 && "props" in gpt4 ? gpt4.props : undefined).toEqual({type: "gpt4"});
        expect(model("glm-4.5v")?.icon).toBe("GLMV");
        expect(model("E06 unknown model")).toBeUndefined();
        expect(provider("OPENAI")?.icon).toBe("OpenAI");
        expect(provider("prefix-openai")).toBeUndefined();
        expect(provider("E06 unknown provider")).toBeUndefined();
    });
});
