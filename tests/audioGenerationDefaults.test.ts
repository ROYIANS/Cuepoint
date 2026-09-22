import { describe, expect, it } from "vitest";
import { defaultMimoConnector, speakerSpeechProfile } from "@/lib/audioGeneration/defaults";
import type { AudioSpeaker } from "@/domain/audio";
import type { ConnectorConfig } from "@/domain/types";

const connection = (id: string, definitionId: ConnectorConfig["definitionId"], apiKey: string): ConnectorConfig => ({ id, definitionId, protocol: "openai-compatible", baseUrl: "https://example.test/v1", apiKey, updatedAt: "2026-09-22" });
const speaker = (input: Partial<AudioSpeaker>): AudioSpeaker => ({ id: "s", projectId: "p", revision: 1, createdAt: "", updatedAt: "", name: "旁白", ...input });
describe("shared speech defaults", () => {
  it("chooses configured MiMo only and never an APIMart fallback", () => {
    const apimart = connection("a", "apimart", "key"), empty = connection("m1", "mimo", "  "), mimo = connection("m2", "mimo", "key");
    expect(defaultMimoConnector([apimart, empty])).toBeUndefined();
    expect(defaultMimoConnector([apimart, empty, mimo])).toBe(mimo);
  });
  it("defaults new/unconfigured voices to MiMo and preserves explicit legacy profiles", () => {
    expect(speakerSpeechProfile()).toEqual({ voice: "mimo_default", speed: 1, mimo: { mode: "preset", instruction: "" } });
    expect(speakerSpeechProfile(speaker({}))).toEqual(speakerSpeechProfile());
    expect(speakerSpeechProfile(speaker({ voice: "alloy", speed: 1.2 }))).toEqual({ voice: "alloy", speed: 1.2 });
    const profile = { mode: "clone" as const, instruction: "自然", referenceMediaId: "sample" };
    expect(speakerSpeechProfile(speaker({ mimo: profile }))).toEqual({ voice: "mimo_default", speed: 1, mimo: profile });
  });
});
