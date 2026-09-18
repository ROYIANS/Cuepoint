import type { ProductionTarget } from "@/domain/production";
import { CHARACTER_SLOTS, PROP_SLOTS, SCENE_SLOTS, STYLE_SLOTS } from "@/domain/types";
import { SHOT_PICTURE_FIELDS } from "@/domain/slot";

function canonical(value: unknown): string {
  if (value === undefined) return '["undefined"]';
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `["array",${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `["object",${Object.keys(value).sort().map((key) => `${JSON.stringify(key)},${canonical((value as Record<string, unknown>)[key])}`).join(",")}]`;
  }
  throw new Error("版本快照包含不支持的数据类型");
}

// Synchronous SHA-256 keeps revision checks inside IndexedDB transactions. The
// token includes ALL entity content, including timestamps/extra, but reveals none
// of that content. It is a conflict token, never an authorization credential.
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

export function targetRevision(value: unknown): string {
  const input = new TextEncoder().encode(canonical(value));
  const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 8, Math.floor(input.length / 0x20000000));
  view.setUint32(bytes.length - 4, input.length * 8);
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Uint32Array(64);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15]!; const y = words[i - 2]!;
      words[i] = words[i - 16]! + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + words[i - 7]! + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a,b,c,d,e,f,g,h] = hash as [number,number,number,number,number,number,number,number];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + K[i]! + words[i]!) | 0;
      const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    for (const [i, word] of [a,b,c,d,e,f,g,h].entries()) hash[i] = (hash[i]! + word) >>> 0;
  }
  return `sha256-v1:${hash.map((word) => word.toString(16).padStart(8, "0")).join("")}`;
}

export function validateProductionTarget(raw: unknown): ProductionTarget {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("生成目标格式无效");
  const value = raw as Record<string, unknown>;
  for (const key of ["projectId", "entityId"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error("生成目标缺少归属或标识");
  }
  const common = { projectId: value.projectId as string, entityId: value.entityId as string };
  if (value.kind === "shot") {
    if (typeof value.episodeId !== "string" || !value.episodeId.trim()) throw new Error("镜头目标缺少集标识");
    if (value.slot !== undefined && !SHOT_PICTURE_FIELDS.includes(value.slot as never)) throw new Error("镜头素材槽位无效");
    return { kind: "shot", ...common, episodeId: value.episodeId, ...(value.slot === undefined ? {} : { slot: value.slot as "firstFrame" | "lastFrame" | "clip" }) };
  }
  const slots = { character: CHARACTER_SLOTS, scene: SCENE_SLOTS, prop: PROP_SLOTS, style: STYLE_SLOTS };
  if (typeof value.kind !== "string" || !Object.hasOwn(slots, value.kind)) throw new Error("生成目标类型无效");
  const kind = value.kind as keyof typeof slots;
  if (!slots[kind].some(({ id }) => id === value.slot)) throw new Error("资产素材槽位无效");
  return { kind, ...common, slot: value.slot } as ProductionTarget;
}
