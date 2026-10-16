import {Validator} from "@cfworker/json-schema";
import {z} from "zod";
import {MCP_LIMITS} from "./limits";
import {freezeMcp, mcpJson, mcpRecord} from "./validation";

const typeName = z.enum(["array", "boolean", "integer", "null", "number", "object", "string"]);
const count = z.number().int().min(0).max(16_384);
const finite = z.number().finite();
const text = z.string().max(2_048);
const primitive = z.union([z.string(), finite, z.boolean(), z.null()]);
const propertyKey = z.string().max(256).refine(key => !Object.hasOwn(Object.prototype, key) && key !== "__proto__");

// This is a supported-keyword admission policy, not an argument validator.
// Argument semantics are implemented by the maintained eval-free validator below.
// Unsupported dynamic/remote refs, regex/format, contains, multipleOf, dependencies
// and unevaluated keywords reject explicitly, including known upstream edge cases.
const schemaNode: z.ZodType<Record<string, unknown> | boolean> = z.lazy(() => z.union([z.boolean(), z.object({
    $schema: z.literal("https://json-schema.org/draft/2020-12/schema").optional(),
    $ref: z.string().regex(/^#\/\$defs\/[A-Za-z0-9_.~-]+$/u).optional(),
    $defs: z.record(propertyKey, schemaNode).optional(),
    type: z.union([typeName, z.array(typeName).min(1).max(7).refine(items => new Set(items).size === items.length)]).optional(),
    title: text.optional(), description: text.optional(), $comment: text.optional(),
    default: z.unknown().optional(), examples: z.array(z.unknown()).max(16).optional(),
    const: primitive.optional(), enum: z.array(primitive).min(1).max(64).refine(values => new Set(values.map(value => JSON.stringify(value))).size === values.length).optional(),
    properties: z.record(propertyKey, schemaNode).optional(),
    required: z.array(propertyKey).max(128).refine(keys => new Set(keys).size === keys.length).optional(),
    additionalProperties: schemaNode.optional(),
    items: schemaNode.optional(), prefixItems: z.array(schemaNode).max(32).optional(),
    minItems: count.optional(), maxItems: count.optional(), minLength: count.optional(), maxLength: count.optional(),
    minProperties: count.optional(), maxProperties: count.optional(),
    minimum: finite.optional(), maximum: finite.optional(), exclusiveMinimum: finite.optional(), exclusiveMaximum: finite.optional(),
    allOf: z.array(schemaNode).min(1).max(8).optional(), anyOf: z.array(schemaNode).min(1).max(8).optional(), oneOf: z.array(schemaNode).min(1).max(8).optional(),
    not: schemaNode.optional(), if: schemaNode.optional(), then: schemaNode.optional(), else: schemaNode.optional(),
}).strict()]));

/** Only called after supported-keyword meta-validation. */
function schemaChildren(schema: Record<string, unknown>): unknown[] {
    return Object.entries(schema).flatMap(([key, value]) => {
        if (["properties", "$defs"].includes(key)) return Object.values(mcpRecord(value));
        if (["items", "additionalProperties", "not", "if", "then", "else"].includes(key)) return [value];
        if (["prefixItems", "allOf", "anyOf", "oneOf"].includes(key) && Array.isArray(value)) return Array.from<unknown>(value);
        return [];
    });
}

function referenceTargets(schema: Record<string, unknown> | boolean, root: Record<string, unknown>, active: Set<string>, depth = 0, budget = {remaining: MCP_LIMITS.schemaNodes}): void {
    if (--budget.remaining < 0 || depth > MCP_LIMITS.schemaDepth) throw new Error("MCP schema 引用过于复杂");
    if (typeof schema === "boolean") return;
    if (typeof schema.$ref === "string") {
        const reference = schema.$ref, name = reference.slice("#/$defs/".length).replaceAll("~1", "/").replaceAll("~0", "~");
        const definitions = root.$defs ? mcpRecord(root.$defs) : {};
        if (active.has(reference) || !Object.hasOwn(definitions, name)) throw new Error("MCP schema 包含循环或未解析的引用");
        const target = definitions[name];
        if (typeof target !== "boolean" && (!target || typeof target !== "object")) throw new Error("MCP schema 引用无效");
        referenceTargets(target as Record<string, unknown> | boolean, root, new Set([...active, reference]), depth + 1, budget);
    }
    for (const child of schemaChildren(schema)) referenceTargets(child as Record<string, unknown> | boolean, root, active, depth + 1, budget);
}

export interface McpCompiledSchema {
    readonly jsonSchema: Readonly<Record<string, unknown>>;
    readonly parse: (input: unknown) => Readonly<Record<string, unknown>>;
}

/** Null prototypes keep required/property checks from treating inherited JS keys as data. */
function validationData(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(validationData);
    if (input && typeof input === "object") {
        const result = Object.create(null) as Record<string, unknown>;
        for (const [key, value] of Object.entries(input)) {
            if (Object.hasOwn(Object.prototype, key) || key === "__proto__") throw new Error("MCP 参数包含不支持的属性名");
            result[key] = validationData(value);
        }
        return result;
    }
    return input;
}

export function compileMcpInputSchema(raw: unknown): McpCompiledSchema {
    const json = mcpJson(raw, MCP_LIMITS.schemaBytes, MCP_LIMITS.schemaDepth, MCP_LIMITS.schemaNodes);
    const schema = mcpRecord(schemaNode.parse(JSON.parse(json)));
    if (schema.type !== "object") throw new Error("MCP input schema 必须是 object");
    referenceTargets(schema, schema, new Set());
    // SDK dereferencing mutates its own copy; captured public schema remains immutable.
    const validator = new Validator(JSON.parse(JSON.stringify(schema)) as Record<string, unknown>, "2020-12", true);
    return Object.freeze({jsonSchema: freezeMcp(schema), parse(input: unknown) {
        const json = mcpJson(input, MCP_LIMITS.argumentsBytes, MCP_LIMITS.schemaDepth, MCP_LIMITS.schemaNodes);
        const owned = mcpRecord(JSON.parse(json));
        if (!validator.validate(validationData(owned)).valid) throw new Error("MCP 参数不符合此工具的 schema");
        return freezeMcp(owned);
    }});
}
