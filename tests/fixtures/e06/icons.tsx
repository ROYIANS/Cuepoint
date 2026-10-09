import {createRoot} from "react-dom/client";
import {ModelIcon as OriginalModelIcon, ProviderIcon as OriginalProviderIcon} from "@lobehub/icons";
import {ModelIcon, ProviderIcon} from "@/components/agent/ModelIcons";
import {modelMappings as publishedModels} from "@lobehub/icons/es/features/modelConfig";
import {providerMappings as publishedProviders} from "@lobehub/icons/es/features/providerConfig";
import {brandLoaders, modelMappings, providerMappings} from "@/components/agent/ModelIconMapping.generated";
import {LobeChatTheme} from "@/components/agent/LobeChatTheme";
import type {ComponentProps} from "react";
import {useState} from "react";

const models = [undefined, "E06 unknown model", "gpt-3.5-turbo", "GPT-4o", "gpt-5", "o3", "claude-sonnet-4", "deepseek-chat", "gemini-2.5-pro", "qwen3", "glm-4.5v", "glm-5", "minimax-m2", "moonshot-v1", "flux", "dall-e-3", "grok-3", "llama-4", "mistral-large", "amazon.nova-pro"];
const providers = [undefined, "E06 unknown provider", "openai", "ANTHROPIC", "deepseek", "google", "qwen", "lobehub", "LobeHub", "ollama", "aihubmix", "apimart", "bailian", "bedrock", "vertexai", "zenmux"];
const types = ["avatar", "mono", "color", "combine", "combine-color"] as const;
const cases = [
    ...models.flatMap(model => types.map(type => ({kind: "model" as const, props: {model, type}}))),
    ...providers.flatMap(provider => types.map(type => ({kind: "provider" as const, props: {provider, type}}))),
    ...[false, true].map(forceMono => ({kind: "provider" as const, props: {provider: "lobehub", forceMono, type: "mono" as const}})),
    {kind: "model" as const, props: {model: "GPT-4o"}},
    {kind: "provider" as const, props: {provider: "openai"}},
    {kind: "model" as const, props: {model: "gpt-4o", size: undefined}},
    {kind: "model" as const, props: {model: "unknown default size", size: undefined}},
    {kind: "provider" as const, props: {provider: "unknown default size", size: undefined}},
    {kind: "provider" as const, props: {provider: "openai", size: 20, shape: "circle" as const}},
];
function Icons() {
    const [index, setIndex] = useState(0);
    window.e06Icons = {count: cases.length, index, verifyCatalog: async () => {
        const results = [];
        for (const [current, original] of [[modelMappings, publishedModels], [providerMappings, publishedProviders]] as const) {
            for (let i = 0; i < current.length; i++) {
                const data = current[i], published = original[i];
                const brand = await brandLoaders[data.icon]();
                results.push({index: i, icon: data.icon, sameIcon: brand.default === published.Icon, sameKeywords: JSON.stringify(data.keywords) === JSON.stringify(published.keywords), sameProps: JSON.stringify("props" in data ? data.props : undefined) === JSON.stringify(published.props)});
            }
        }
        return results;
    }, set: setIndex, current: cases[index]};
    const item = cases[index];
    const caller = {size: 32, shape: "square" as const, className: "e06-caller", style: {color: "rgb(220, 40, 60)"}, color: "#dc283c", title: "E06 caller name"};
    return <LobeChatTheme><div style={{display: "flex", gap: 40, padding: 40}}>
        <div id="original">{item.kind === "model" ? <OriginalModelIcon {...caller} {...item.props}/> : <OriginalProviderIcon {...caller} {...item.props}/>}</div>
        <div id="current">{item.kind === "model" ? <ModelIcon {...caller} {...item.props}/> : <ProviderIcon {...caller} {...item.props}/>}</div>
    </div></LobeChatTheme>;
}
declare global {
    interface Window {
        e06Icons: {count: number; index: number; verifyCatalog: () => Promise<{index: number; icon: string; sameIcon: boolean; sameKeywords: boolean; sameProps: boolean}[]>; set: (index: number) => void; current: {kind: string; props: ComponentProps<typeof OriginalModelIcon> | ComponentProps<typeof OriginalProviderIcon>}};
    }
}
createRoot(document.getElementById("root")!).render(<Icons/>);
