# Audio Voiceover and Multitrack Workspace: Implementation

Status: planning; await latest parent final-summary approval, satisfy dependencies, then activate this child.

## Dependency

Foundation complete. Establish the shared generation coordinator/job contract before Music consumes it.

## Ordered checklist

- [ ] Implement decoded-source import and checked segment/speaker/take operations.
- [ ] Implement and test the recorder lifecycle and browser microphone/import workflow.
- [ ] Build pure edit/schedule logic, waveform UI, synchronized playback and meaningful sample tests.
- [ ] Implement snapshot-based WAV rendering, resource preflight and chapter/project export.
- [ ] Add APIMart TTS and the shared durable generation claim/coordinator.
- [ ] Verify complete manual workflow, narrow/keyboard controls and focused tests/typecheck; record browser evidence.

## Validation

Use the [parent gate/command plan](../../../09-22-apimart-audio-music/implement.md), with the explicit local pnpm path. Add meaningful tests for this child's listed acceptance behavior rather than implementation-mirroring assertions. Run focused tests and typecheck after changed code; use the integrated full gate at the final child.

- Complete a recording/import -> edit -> mix -> WAV export flow without Agent or API credentials.
- Mic denial, device loss, late permission resolution and final recorder chunks are handled without leaked capture or a falsely saved take.
- Decoded synthetic samples verify overlap, seek offsets, trim/fade/gain/mute/solo and ordered chapters; output WAV headers and samples are valid.
- Retakes and script edits preserve source bytes and selection; stale undo/replacement cannot overwrite newer state.
- TTS validation and response fixtures cover length, supported format, JSON errors, uncertain interruption and duplicate clicks.
- Browser evidence verifies actual decoding, waveforms, playback and export; resource preflight rejects unsafe renders before allocation.

## Risks and rollback

Affected ownership: src/components/audio/; src/lib/audio/; audio repository edit commands; src/lib/ai/apimartAudio.ts; shared src/lib/audioGeneration/; scoped routes and required media integration. Validate legacy behavior at those boundaries. Stop on a failed invariant, keep saved originals, and revert code/availability rather than removing project data. Follow trellis-before-dev and trellis-check; curated JSONL context is required only if the selected workflow dispatches subagents.

## Integrated delivery evidence

Implementation complete and in review. See [parent validation](../../../09-22-apimart-audio-music/validation.md) for the full automated/browser evidence and explicit live-provider/hardware limits. Final UI retains existing shadcn defaults. No Git commit/push or archive has been performed.
