import type { AudioSpeaker, MimoSpeechSettings } from "@/domain/audio";
import type { ConnectorConfig } from "@/domain/types";
import { SPEECH_VOICES } from "@/lib/ai/apimartAudio";

/** Select MiMo only when it is configured; never silently route to another provider. */
export function defaultMimoConnector(connections: readonly ConnectorConfig[]): ConnectorConfig | undefined {
  return connections.find((connection) => connection.definitionId === "mimo" && connection.apiKey.trim().length > 0);
}

export function speakerSpeechProfile(speaker?: AudioSpeaker): { voice: string; speed: number; mimo?: MimoSpeechSettings } {
  if (!speaker) return { voice: "mimo_default", speed: 1, mimo: { mode: "preset", instruction: "" } };
  if (speaker.mimo) return { voice: speaker.voice ?? "mimo_default", speed: 1, mimo: speaker.mimo };
  // Existing speakers without a MiMo profile remain APIMart-compatible.
  if (speaker.voice && (SPEECH_VOICES as readonly string[]).includes(speaker.voice)) return { voice: speaker.voice, speed: speaker.speed ?? 1 };
  return { voice: "mimo_default", speed: 1, mimo: { mode: "preset", instruction: "" } };
}
