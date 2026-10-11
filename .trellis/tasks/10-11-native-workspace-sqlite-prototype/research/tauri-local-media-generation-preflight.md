# Research: Local synthetic H.264/AAC fixture generation

- Query: Verify a tiny locally generated H.264/AAC MP4 and AAC audio using existing macOS tools; determine whether an already available scoped local tool can generate MP3 without installation or remote media.
- Scope: local developer probe with primary AVFoundation API references. Only this task's research directory was written. No product/config edits, dependency installation, CUA, microphone, print, paid request, credentials, lifecycle/spec or Git operation.
- Date: 2026-10-11

## Findings

### Successful files and actual native decoding

Temporary samples are under `research/media-preflight-temp/` (ignored by the coordinator). They are developer inputs, not packaged WKWebView acceptance. The implementer may copy selected verified bytes into the owned package fixture directory and adopt the generator under its own quality gates.

| File | Bytes | Actual AVFoundation format/duration/decode | SHA-256 |
| --- | ---: | --- | --- |
| `tone.wav` | 192044 | Generated PCM16, 48 kHz mono, 96000 samples / 2 seconds | `34ca5acf48489e2dca1c236155d6b36a4daf84c615ce9ffff681dc4acfed2819` |
| `tone.aac` | 8900 | AAC in ADTS; AVFoundation duration 2.048 s, 98304 decoded samples, reader completed | `9e3ec7c7e1a24b4c76730c12fe4737695cf8413fb00a6f9139b50325273d48b6` |
| `tone.m4a` | 12324 | AAC in M4A; 2 s, 96000 decoded samples, reader completed | `2493423bb0a6636b1da138a5c2db6c258d788841a30f8e5e8a28860436ed5f6f` |
| `silent.mp4` | 2769 | H.264 `avc1`, 64×48, 12 fps, 2 s; 24 decoded frames, reader completed | `b45027c1f884c9d50908b6089e4d0e934eee692c195bfd6f10c3fe60b3e953c7` |
| `movie.mp4` | 11940 | H.264 `avc1` + mono 48 kHz AAC; 2 s; 24 decoded video frames and 96000 decoded audio samples, readers completed | `91f3d0a1a72de8355add6814fa4ed8b47bc3cac5ebb02c62dcd8b5b7a5a32341` |

The WAV is a quiet synthetic 440 Hz sine with signed-16 amplitude 1200, not microphone input. Video is 24 synthetic colored 64×48 BGRA frames with explicit CMTime timestamps. Encoding and muxing use [AVAssetWriter](https://developer.apple.com/documentation/avfoundation/avassetwriter) and [AVAssetExportSession](https://developer.apple.com/documentation/avfoundation/avassetexportsession); verification loads real AVURLAsset track formats/duration and uses [AVAssetReader](https://developer.apple.com/documentation/avfoundation/avassetreader) to decode each stream to BGRA/PCM. Nothing was played through speakers.

ADTS lacks the M4A priming/trimming metadata: afinfo estimates 2.004625 s while AVFoundation decodes 2.048 s; both observations are preserved, not silently equated to the 2 s original. Prefer M4A for exact trimmed-duration expectations; label ADTS padding explicitly in browser checks.

### Working commands and source provenance

Host receipt: macOS **27.0.1**, build **26A434**; Apple Swift **6.4**, target `arm64-apple-macosx27.0.0`. The compiler is already installed at `/Library/Developer/CommandLineTools/usr/bin/swiftc`. The probe compiled using Swift 5 language mode; its current SDK reports deprecation warnings for older writer/reader/export APIs. Both compilations exited 0; raw warnings are retained. This is a temporary developer probe, not a claim that the generator has passed permanent package style/strict-warning gates.

Generator source is `research/media-preflight-temp/generate.swift`, **7127 bytes**, SHA-256 **e1b4cb5f25a81b107dc1ffa59e0b7f1380ca224a222cbec694934b52a8e180e8**. The exact source snapshot is retained outside the ignored temporary subtree in `research/tauri-local-media-generation-logs/generator-source.txt`; source/fixture hashes are in `source-fixture-manifest.json`. It has `video`, `mux` and `inspect` subcommands, refuses existing output paths, and emits JSON verification only after reader completion. All commands with absolute arguments and exit/stdout/stderr are preserved in the adjacent JSON logs.

Using `PROBE_DIR` as a task-specific variable resolved to the owned temporary directory, the successful command forms are:

```sh
/usr/bin/afconvert -f adts -d aac -b 64000 "$PROBE_DIR/tone.wav" "$PROBE_DIR/tone.aac"
/usr/bin/afconvert -f m4af -d aac -b 64000 "$PROBE_DIR/tone.wav" "$PROBE_DIR/tone.m4a"
/Library/Developer/CommandLineTools/usr/bin/swiftc -swift-version 5 -parse-as-library -module-cache-path "$PROBE_DIR/module-cache" "$PROBE_DIR/generate.swift" -o "$PROBE_DIR/media-probe"
"$PROBE_DIR/media-probe" video "$PROBE_DIR/silent.mp4"
"$PROBE_DIR/media-probe" mux "$PROBE_DIR/silent.mp4" "$PROBE_DIR/tone.m4a" "$PROBE_DIR/movie.mp4"
"$PROBE_DIR/media-probe" inspect "$PROBE_DIR/tone.aac" "$PROBE_DIR/tone.m4a"
```

The minimal original WAV recipe uses Python's installed standard library, with no package/runtime dependency:

```python
import math, struct, wave
with wave.open(output_wav_path, "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(48000)
    output.writeframes(b"".join(
        struct.pack("<h", round(math.sin(i * 2 * math.pi * 440 / 48000) * 1200))
        for i in range(96000)
    ))
```

Synthetic signal/frame parameters are deterministic; encoded MP4/M4A container bytes are not promised to reproduce the same hash on different runs, OSes or hardware encoders. Freeze selected generated fixture bytes and provenance before acceptance. No new package, SDK, Rust component, global tool or bundled pnpm was invoked.

### MP3: actual failed encoding attempt and scoped tool search

The same installed afconvert supports listing MPG3 data/file formats, but this does **not** establish an encoder. Actual command:

```sh
/usr/bin/afconvert -f MPG3 -d .mp3 "$PROBE_DIR/tone.wav" "$PROBE_DIR/tone.mp3"
```

It exited **1**, with the original diagnostic:

```text
Error: ExtAudioFileSetProperty ('cfmt') failed ('fmt?')
```

No MP3 sample was generated. `command -v` did not locate lame/ffmpeg/ffprobe, and neither `/opt/homebrew/bin/{ffmpeg,lame}` nor `/usr/local/bin/{ffmpeg,lame}` existed. Scoped checks found no lameenc/pydub/av/ffmpeg Python module in the supplied dependency runtime, and no lamejs/@breezystack/lamejs/@jambonz/mp3encoder/ffmpeg-static module in either root or supplied Node library directories. These checks do not exhaust all user-installed application bundles; they establish that the already selected tools/library paths cannot supply the needed MP3 encoder. No install, remote sample, invented MIME substitution or paid workaround was attempted.

If MP3 remains a required Stage B input, report it as an unresolved input-generation gate until another already available, authorized local encoder/input is identified. AAC/MP4/WAV success cannot satisfy an MP3-specific acceptance claim.

### Logs and handoff

`research/tauri-local-media-generation-logs/` retains raw command receipts: `aac-adts.json`, `aac-m4a.json`, first `mp3-attempt.json`, first `compile.json`, `compile-with-decode.json`, `video-generate.json`, `audio-video-mux.json`, `aac-native-inspect.json`, `afinfo-{adts,m4a}.json`, `swift-version.json`, `host.json`, plus exact final source and hashes. Compiler warnings and first failure were retained rather than replaced by a summary-only success record.

The exact sample paths and native receipts were sent to `/root` and the existing `/root/native_tauri_storage` implementer. The implementer owns all package source, permanent generator/fixtures and real packaged acceptance; this researcher did not edit that scope. Temporary binaries/cache/media stay outside commits; retain only needed provenance and raw evidence.

## Caveats / Not Found

- This probe proves local developer generation, metadata and native decode on the stated host. It does not prove packaged WKWebView video/audio decode, playback/seek, Blob/CSP transport, microphone or export behavior.
- No scoped installed MP3 encoder was found, and Apple afconvert's real MP3 attempt failed. The MP3-specific input/gate remains open.
- Codec padding differs between raw ADTS and trimmed M4A; assert the observed container semantics instead of assuming every compressed sample is exactly 2 s.
- Temporary Swift uses older public APIs that remain functional but deprecated in this SDK. Permanent adoption belongs to the implementation owner and its quality gates.
- All writes obeyed the research-only boundary after coordinator acknowledgement; the proposed desktop/.acceptance temp path was not used.
