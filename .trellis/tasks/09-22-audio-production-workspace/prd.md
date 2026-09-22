# Audio Voiceover and Multitrack Workspace

## Goal

Deliver the assigned portion of [the parent requirements](../09-22-apimart-audio-music/prd.md) as an independently verifiable checkpoint of the same release.

## Scope and requirements

Owns R2–R6, audio portions of R8, R10.

1. Build chapter/speaker/script/take interaction with a usable blank one-chapter project and optional text for imported clips.
2. Support explicit microphone recording, level feedback, keep/discard/another take, library adoption and local audio import without API credentials.
3. Implement waveform multitrack editing, positioning, trims, splits, gain, mute/solo, fades and revision-safe undo with numeric alternatives.
4. Use one schedule for synchronized preview and chapter/whole-project WAV export; preserve source audio and export snapshot identity.
5. Implement APIMart TTS with documented inputs, binary/error parsing, saved source settings and exactly one locally claimed submission per intent.

## Dependencies

Foundation complete. Establish the shared generation coordinator/job contract before Music consumes it.

## Acceptance

Covers AC2–AC6, audio portions of AC8/AC12.

- [ ] Complete a recording/import -> edit -> mix -> WAV export flow without Agent or API credentials.
- [ ] Mic denial, device loss, late permission resolution and final recorder chunks are handled without leaked capture or a falsely saved take.
- [ ] Decoded synthetic samples verify overlap, seek offsets, trim/fade/gain/mute/solo and ordered chapters; output WAV headers and samples are valid.
- [ ] Retakes and script edits preserve source bytes and selection; stale undo/replacement cannot overwrite newer state.
- [ ] TTS validation and response fixtures cover length, supported format, JSON errors, uncertain interruption and duplicate clicks.
- [ ] Browser evidence verifies actual decoding, waveforms, playback and export; resource preflight rejects unsafe renders before allocation.

## Out of scope

Do not expand the [parent exclusions](../09-22-apimart-audio-music/prd.md). Other children's primary deliverables remain with their owning task; necessary shared-contract changes must be reflected in the parent design.

## Status

Planning complete for final parent review; implementation not started. Read this task's design.md and implement.md and the parent summary approval before activation.
