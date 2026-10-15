import type {ConnectorConfig} from "../../../domain/types";
import scope from "./scope.json";

/** Models.dev providers whose models count as the model's original vendor (reference prices). */
export const ORIGIN_PROVIDERS: ReadonlySet<string> = new Set(scope.originProviders);

/** Models.dev publishes no `api` for openai, so its origin is fixed here. */
const OPENAI_ORIGIN = "https://api.openai.com";

/** Connector definitions with a fixed Models.dev provider, regardless of a custom base URL. */
const FIXED_PROVIDERS: Readonly<Partial<Record<ConnectorConfig["definitionId"], string>>> = {
    deepseek: "deepseek",
    aihubmix: "aihubmix",
    mimo: "xiaomi",
};

function originOf(baseUrl: string): string | undefined {
    try {
        return new URL(baseUrl).origin;
    } catch {
        return undefined;
    }
}

/**
 * The connector's own Models.dev provider. `apimart` has none. `openai-compatible` is matched by
 * the origin of its current base URL, so a user-changed URL never inherits OpenAI's data; an
 * origin shared by several providers matches none.
 */
export function connectorProviderId(
    connector: Pick<ConnectorConfig, "definitionId" | "baseUrl">,
    providerOrigins: Readonly<Record<string, string>>,
): string | undefined {
    const fixed = FIXED_PROVIDERS[connector.definitionId];
    if (fixed) return fixed;
    if (connector.definitionId !== "openai-compatible") return undefined;
    const origin = originOf(connector.baseUrl);
    if (!origin) return undefined;
    const matches = new Set<string>();
    if (origin === OPENAI_ORIGIN) matches.add("openai");
    for (const [provider, providerOrigin] of Object.entries(providerOrigins)) if (providerOrigin === origin) matches.add(provider);
    return matches.size === 1 ? [...matches][0] : undefined;
}
