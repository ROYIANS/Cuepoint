# Synthetic native import and Save panel oracles

These files were generated fresh from code, without reading prior media or user
files. `source-provenance.json` contains every source byte count/hash and the
distinctive document marker `CUEPOINT-NATIVE-FULL-20261011-Q7`. The PNG is a
96x64 color-block pattern. WAV is a quiet 440 Hz, mono PCM16, 48000 Hz, two-second
tone. MP4 is freshly generated using the existing AVFoundation source, H264,
64x48, 12 fps, 24 frames, two seconds. The video generator's decode inspection is
in generation-video.log. Document TXT/MD/PDF/DOCX share distinctive Chinese story
text. verification.log verifies all hashes and basic decode/marker properties.

## Import/read/reopen

Import each through the normal product's real picker. UI parsing should find
the marker and Chinese rain-night/red-umbrella/blue-station lines; preserve
document kind/name. Imported internal copies should have equal source hash and
length; image/video/audio must preview or decode, and records/Blobs should remain
after complete app close/reopen. This manifest alone is not that product proof.

## Actual system Save scenarios

1. **Cancel:** begin a shared product export, then cancel the native Save panel.
   No success toast. No chosen destination and no `.cuepoint-export-*.tmp` file
   should appear. Another export must still work (transfer capacity released).
2. **Fresh target:** select a fresh output name in a test output directory, await
   completed UI feedback, then verify disk bytes/length and SHA-256 against the
   actual generated Blob or independent domain oracle. CSV may be compared with
   the current episode rows/column quoting; ZIP contents may be independently
   inspected; WAV metadata/sample count may be compared with the rendered mix.
   Never use the arbitrary synthetic source hash as a generated ZIP/CSV oracle.
3. **Existing empty target:** `existing-empty.csv` has length zero and SHA-256
   e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
   Select it. If macOS asks whether to replace, choosing Replace must still lead
   to the service's safe existing-target rejection. The file stays empty, no
   success toast, and no temporary stage remains.
4. **Existing nonempty target:** `existing-keep.csv` has 40 bytes and SHA-256
   5015c92162771643b5d790bf7a7c0582f1b2018360de44dd18f631009f65c041.
   Select it and observe safe rejection; bytes/hash must remain identical.
   macOS confirmation itself is not the no-overwrite proof: disk hash is.
5. **More than 32 MiB / zero bytes:** native Rust disk regression already covers
   both. A normal product export only proves its actual generated size; do not
   claim packaged large/empty acceptance if the available product UI cannot
   produce those files. No replacement synthetic IPC harness may stand in for
   normal product evidence.

The save backend's final hard-link publication is irreversible. Directory-sync
or stage-cleanup failure returns publishedWithError; the renderer says “文件已保存”
and must not report cancellation or retry automatically. This injected failure
has Rust proof; do not invent an actual OS-failure UI outcome. Likewise a late
abort may lose to publication, in which case Saved remains the truthful result.
