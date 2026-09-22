# Design

## Boundary
Current runtime and UI only accept APIMart speech. Extend the existing connector, speech job and speaker profile contracts, not a parallel generation system. No music arrangement, new standalone editor, cloud voice ID registration, or low-latency streaming playback in this scope. Use non-streaming WAV response for all three supported models so existing decode/recovery works.

## Shared contract
`MimoSpeechSettings` in domain/audio.ts: `{ mode: "preset" | "design" | "clone"; instruction: string; referenceMediaId?: string; optimizeTextPreview?: boolean }`. AudioSpeaker adds optional `mimo?: MimoSpeechSettings`. Legacy voice/speed remain; voice holds MiMo preset ID when using preset (ignored in design/clone). AudioGenerationInput speech adds optional `mimo?: MimoSpeechSettings`; absent means existing APIMart. Speech speed must be 1 for MiMo (natural-language instruction controls tempo). Use strict mode validation: reference only clone and required there; optimization only design; instruction required design.

Provider adapter src/lib/ai/mimoSpeech.ts exports MIMO_VOICES, MIMO_MODELS, generateMimoSpeech(credentials, {text, voice, mimo, referenceBlob?}, options) -> `{ok:true, blob, finalTextPreview?, model}` or `{ok:false,kind,message}` with existing failure kind convention. Clone serialized data URI only at transport; no base64 in durable job or tool args. Provider adapter uses Bearer authentication and fixed chat/completions route, stream false, audio.format wav. Native message roles respected.

Generation connector provider and provenance extend to mimo. Freeze owned immutable reference media ID at preparation and verify before submission; keep referenced media in retention and package remapping. Save raw response before decode, preserve finalTextPreview in result and use actual spoken text for take snapshot, never silently overwrite script. Reusable voices are project speaker profiles and reference media, since documented API returns audio rather than reusable hosted voice IDs. No schema version needed for optional fields unless storage inspection proves otherwise.

UI selects configured speech provider, then compact preset/design/clone modes. Save profile explicitly to speaker; allow selected source/take as reference. Default generation uses manuscript unchanged. Cloning upload uses actual WAV/MP3 validation and existing owned media/source lifecycle. Model transport options hidden behind task semantics; optional controls in disclosures.

Agent extends existing speech tool with optional MiMo fields and capabilities. Review includes model/mode, spoken text, instruction, sample identity and optimization. No microphone/file picker controlled by Agent. Preserve durable confirmation and frozen project scope.

Source: user supplied full MiMo-V2.5-TTS docs attachment; official https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5 confirms model roles, clone data URI, 10 MB encoded limit and output format.

## UX follow-up boundary
Root owns SpeechControls simplification, new VoiceLibrary dialog, contextual/top toolbar entry and inline MiMo setup. Existing project speakers serve as reusable voices; no new table or global library. Shared defaults helper selects configured MiMo only by default (no silent APIMart fallback), resolves existing speaker profiles without migrating legacy data. Agent owner updates audio_create speaker defaults and audio_generate_speech to support optional connector/voice/speed and speakerId; paid approval snapshots must include resolved profile revision and preserve existing job replay. Manual and Agent share defaults/repositories. Voice editor uses CAS, optional advanced text optimization; audition uses existing job runtime with no manuscript mutation.
