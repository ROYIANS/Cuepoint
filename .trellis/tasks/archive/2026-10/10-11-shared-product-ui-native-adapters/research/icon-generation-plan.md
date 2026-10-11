# Native icon generation plan

The tracked Tauri bundle references `desktop/tauri/src-tauri/icons/icon.png` and `icon.icns`. The current PNG is 128×128 RGBA with transparent corners, and exporting the ICNS with macOS `sips` yields a 1024×1024 RGBA image with the same transparent treatment. The web logo contract in `public/brand/README.md` requires preserving the supplied alpha, so the web artwork must remain untouched.

Use the existing shared navigation/brand surface `#0c0c0c` as the native icon background. Create a reproducible native-only square source that composites the current mark over that color, then run the pinned `@tauri-apps/cli` 2.12.1 `tauri icon` generator into `desktop/tauri/src-tauri/icons`. Verify the generated PNG/ICNS corners are opaque and RGB `12,12,12`, and visually inspect the packaged `.app` icon.

The source must be kept separate from `public/brand/` so browser favicon/logo alpha and version declarations remain unchanged. Regeneration is reversible by replacing only the native icon set.
