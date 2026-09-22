# Audio Voiceover and Multitrack Workspace: Design

The [parent design](../../../09-22-apimart-audio-music/design.md) is authoritative for cross-child contracts. This document identifies this child's concrete implementation boundaries.

## Owned modules

src/components/audio/; src/lib/audio/; audio repository edit commands; src/lib/ai/apimartAudio.ts; shared src/lib/audioGeneration/; scoped routes and required media integration.

## Design decisions

- Follow parent design sections 2–5 and 9. Separate immutable takes from placed clips and script ordering from timeline ordering.
- Recorder is a disposable state machine around user-initiated MediaRecorder; use actual supported MIME and wait for final data before validation.
- Create reduced waveform peaks and bounded decoded caches. Pointer edits preview locally and commit once through the same command API as numeric edits.
- Web Audio preview and OfflineAudioContext export consume a pure schedule. Encode 48 kHz stereo PCM16 WAV; disclose any uniform clipping-prevention attenuation.
- Preflight source availability, decoded memory and output size; establish a tested conservative budget and chapter-export fallback. Do not claim arbitrary long-form capacity.
- TTS and shared job state use project ownership rather than chat lifetime; lost binary responses remain uncertain and are not automatically resubmitted.

## Dependency and compatibility

Foundation complete. Establish the shared generation coordinator/job contract before Music consumes it. Existing video, material and Agent contracts remain supported. Preserve user source media and project ownership; no destructive data rollback.
