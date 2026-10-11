# Native opaque icon implementation evidence

## Change boundary

- Behavior gap: the native PNG and ICNS have transparent corners, allowing a light system surface to show through. The requested native tile must have the shared navigation background `#0c0c0c`.
- Owner: native bundle raster resources under `desktop/tauri/src-tauri/icons/`; `tauri.conf.json` already references `icon.png` and `icon.icns`.
- Expected changes: a native-only 1024×1024 composited source, desktop PNG/ICNS/ICO derivatives, provenance manifest, a reproducible generation/read-only artifact check script, and native resource documentation.
- Source: use the approved 1024×1024 `public/brand/logo.webp` without upscaling, resizing, cropping or reconstructing the mark before composition.
- Exclusions: no Web logo/favicon changes, no UI/schema/bridge edits, no mobile/store resource installation, no application build or commit in this delegated batch.

## Verification

Completed asset-level verification. The parent task owns packaged-app inspection after the shared UI and storage batches are integrated.

### Delivered resources

- `desktop/tauri/scripts/generate-native-icons.py`: generation through the installed/pinned Tauri CLI, native-only temporary output filtering, deterministic ICNS normalization, and read-only artifact/bundle verification.
- `desktop/tauri/src-tauri/icons/source.png`: original 1024×1024 approved pixels composited directly onto `[12,12,12,255]`, with no source resize, crop or reconstruction.
- Native PNG sizes: 16, 32, 64, 128, 256 and 512 pixels. `icon.png` is now the CLI's standard 512-pixel bundle output.
- Native ICNS: the same 8 modern PNG member types as the original repository resource (`ic07`–`ic14`), physical sizes 32–1024, including 16pt at 2×.
- Native ICO: 16, 24, 32, 48, 64 and 256 pixels.
- `icons/README.md` and `icons/provenance.json`: commands, background/source policy, exact generator versions and original/native/Web generation hashes.
- `tauri.conf.json` was not changed; its existing `icon.png` / `icon.icns` references already select the new resources. No mobile/store assets were installed.

### Actual commands and outcomes

Python available for this batch:

```text
/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
Pillow 12.3.0
```

Generation:

```sh
/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B \
  desktop/tauri/scripts/generate-native-icons.py \
  --pnpm /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm
```

- Passed with the installed `@tauri-apps/cli` 2.12.1. Six desktop PNGs, source PNG, ICNS and ICO generated; other CLI platform resources were temporary and discarded.
- Repeated final generation produced byte-identical files, including the provenance manifest. See `icon-reproducibility.json`.

Read-only checks:

```sh
/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B \
  desktop/tauri/scripts/generate-native-icons.py --check
iconutil --convert iconset --output /tmp/cuepoint-opaque-final-native.iconset \
  desktop/tauri/src-tauri/icons/icon.icns
```

- Seven standalone PNGs (including source), all 8 ICNS PNG members, and all 6 ICO sizes have alpha range `[255,255]`; every corner is `[12,12,12,255]`.
- Source pixels exactly equal alpha compositing of the original approved 1024-pixel WebP. Its size, center and framing are unchanged.
- Native hashes match provenance; all 7 Web brand files and `index.html` match the original generation evidence. No Web files were modified.
- macOS `iconutil` successfully exported the final ICNS; all 8 exported PNGs independently passed full alpha and corner RGB checks. See `icon-independent-checks.json`.
- Five deliberate temporary corruptions were rejected: non-corner PNG transparency, wrong corner RGB, original artwork pixel change, small retina ICNS transparency, and 1024-pixel ICNS transparency. Product files were not modified by these negative checks.
- Visual inspection of the native 1024-pixel source confirmed the existing star/spectral mountain/reflection artwork over the uniform dark outer background.
- `git diff --check` passed. No application build, commit or push was performed by this delegated batch; main owns the integrated gates and packaging.
- Python cache files created during early inspection were removed; subsequent commands used `-B`.

### Failed checks and correction

1. The initial container checker assumed all Tauri ICNS members were modern PNGs. Actual CLI output also contained legacy `is32/s8mk` and `il32/l8mk`; the checker rejected that unexpected set before installing it. Inspection was expanded to include those RGB/alpha pairs.
2. Pillow then passed the legacy members, but macOS `iconutil` emitted `[12,12,0,255]` at lower corners of the 16/32-pixel non-retina exports. Replacing them with `icp4/icp5` PNGs was also misinterpreted by that conversion chain.
3. Rebuilding the same iconset with Apple's own `iconutil` compiler reproduced the blue-channel corner mismatch. This observation does not establish a Tauri-specific encoding bug or prove the installed app's visual behavior.
4. The final resource retains the repository's original supported modern PNG member set, omits the legacy small entries, and sorts members for deterministic container bytes. All final members pass both Pillow and macOS conversion checks; separate 16-pixel PNG/ICO resources remain available. No logo pixels were modified to compensate for decoder behavior.

### Packaged follow-up

After the integrated `.app` build, main should run:

```sh
/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B \
  desktop/tauri/scripts/generate-native-icons.py --check \
  --bundle 'desktop/tauri/.acceptance/builds/<build>/Cuepoint Prototype.app'
```

This resolves the real bundle's `CFBundleIconFile`, compares its ICNS hash with the tracked native artifact and repeats all member checks. Current expected native ICNS SHA-256:

```text
95553f48e1c5c628626d8b245dc0ff4ea4a893a6cbb76974d58315cc6297232e
```

Finder/Dock inspection remains a separate packaged visual check; it has not been represented as completed here. The generator requires Python with Pillow but adds no application runtime dependency. Broader Web hashes are evidence for this generation, not a permanent failure gate for later unrelated sponsor/README/favicon edits.
