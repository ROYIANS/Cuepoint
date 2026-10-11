# Research: Native macOS application icon background

- Query: Determine why the packaged Tauri macOS icon shows a light background, how the current logo/icon artifacts are generated and consumed, and the smallest source/derived-artifact change needed to use a black background matching the product design.
- Scope: mixed (repository inspection plus installed Tauri/macOS tooling)
- Date: 2026-10-11

## Findings

### Current source and generated artifacts

- `desktop/tauri/src-tauri/icons/icon.png` is a 128×128 RGBA PNG. It is entirely transparent outside the mark: the decoded image has 7,155 pixels with alpha 0 and no fully opaque pixels (maximum alpha 253). Its top-left and corner pixels are `(0,0,0,0)`. The RGB zero values in transparent pixels do not create a black canvas; the alpha channel is what controls compositing.
- `desktop/tauri/src-tauri/icons/icon.icns` is a 744,739-byte macOS icon container. `iconutil --convert iconset` expands it to 9 PNG members (16–1024 px variants); every inspected member preserves the same transparent canvas and has the same alpha profile. The ICNS therefore cannot provide a baked black background that is absent from `icon.png`.
- The icon PNG is visually/structurally derived from the approved symbol in `public/brand/logo-256.png`: resizing the 256×256 PNG to 128×128 with macOS `sips` yields the same dimensions and a very small pixel difference (mean absolute channel difference ≈0.49; 9,850/16,384 pixels exactly equal). The existing icon was likely exported from this symbol using an equivalent resampling/export path; there is no checked-in source manifest or generation script in the repository.
- `public/brand/logo.webp`, `logo-256.png`, `logo-32.png`, and `logo-16.png` all preserve the supplied alpha channel by design. `public/brand/README.md:3-4,15-18` explicitly says to preserve alpha and says the About page places the lockup on black to keep its partially transparent dark background uniform. The browser brand reference is `src/lib/brand.ts:7-8`; it is separate from Tauri bundle resources.

### Why the packaged icon appears light

- Tauri bundle configuration points directly to the transparent resources at `desktop/tauri/src-tauri/tauri.conf.json:16-18` (`"icon": ["icons/icon.png", "icons/icon.icns"]`). No background color or alternate macOS icon is configured.
- macOS composites a transparent app icon over Finder/Launchpad/system presentation surfaces. With this alpha-only icon, the system surface shows through; a light Finder/desktop surface therefore makes the overall icon tile look light even though the logo's transparent RGB bytes are black. This is a presentation/compositing result, not a mismatch in the star/spectral logo artwork.
- The product design tokens are explicit in `src/styles.css:49-55` and `.trellis/spec/frontend/desktop-ui.md:37`: navigation `#0c0c0c`, app `#101010`, panel `#151515`, elevated `#202020`. The brand README's black placement guidance and the user's request both support baking a dark background into the native icon while leaving web logo assets transparent.

### Smallest change recommendation

1. Keep `public/brand/*` unchanged. Those assets intentionally preserve alpha for web/UI usage; changing them would alter browser favicon and in-app logo behavior unnecessarily.
2. Create a dedicated native icon source/derived artifact from `public/brand/logo-256.png` by alpha-compositing it onto an opaque square background. Use `#0c0c0c` when matching the navigation/chrome surface is desired; use `#101010` only if the icon is explicitly intended to match the main application surface. The existing UI contract names `#0c0c0c` as the navigation/outer chrome color, so `#0c0c0c` is the stronger default for the app tile. Preserve the supplied mark and its relative framing; only flatten the transparent canvas behind it.
3. Regenerate both native outputs from that opaque square source: the checked-in `desktop/tauri/src-tauri/icons/icon.png` and `desktop/tauri/src-tauri/icons/icon.icns`. Do not hand-edit only the ICNS: Tauri accepts both paths and future builds must have consistent source/derived artifacts.
4. Keep the generation command/script reproducible. The installed Tauri CLI is `@tauri-apps/cli 2.12.1` (`desktop/tauri/package.json:10-12`) and exposes `tauri icon [INPUT] -o, --output <OUTPUT>`; it accepts a square PNG or SVG with transparency. A manifest can specify `bg_color`, but the CLI help documents that field as affecting the iOS background (`--ios-color`); it should not be relied on to flatten the macOS source. The robust path is to bake the opaque background into the native PNG first, then run the Tauri icon generator.

### Local regeneration and acceptance commands

- Inspect the current transparent source:

  ```sh
  sips -g pixelWidth -g pixelHeight -g hasAlpha -g format -g space \\
    desktop/tauri/src-tauri/icons/icon.png
  ```

- Generate native sizes with the pinned local CLI (write to a temporary output during review, then copy the reviewed artifacts into `src-tauri/icons`):

  ```sh
  /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm \\
    --dir desktop/tauri exec tauri icon <opaque-native-source.png> \\
    --output /tmp/cuepoint-tauri-icons
  ```

  The command is available from `@tauri-apps/cli@2.12.1`; its `--help` reports PNG/SVG input and configurable output.

- Verify the generated ICNS members and alpha after regeneration:

  ```sh
  iconutil --convert iconset \\
    --output /tmp/cuepoint-icon.iconset \\
    desktop/tauri/src-tauri/icons/icon.icns
  find /tmp/cuepoint-icon.iconset -maxdepth 1 -type f -print
  sips -g pixelWidth -g pixelHeight -g hasAlpha -g format -g space \\
    desktop/tauri/src-tauri/icons/icon.png \\
    /tmp/cuepoint-icon.iconset/icon_512x512.png
  ```

  The native source and ICNS members should report the expected sizes and an opaque canvas (`alpha` should be 255 at corners; a pixel-level check should find no fully transparent corner pixels). The logo itself may retain antialiased edge alpha after compositing, but the final canvas must not be transparent.

- Build and inspect the actual packaged resource:

  ```sh
  /Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm \\
    --dir desktop/tauri build:app
  find desktop/tauri/.acceptance/builds -path '*Cuepoint Prototype.app/Contents/Resources/icon.icns' -print
  ```

  The packaged `.app/Contents/Resources/icon.icns` must be the regenerated opaque-background artifact. A visual Finder/Launchpad check should show the same dark `#0c0c0c` tile rather than the desktop/light surface showing through.

## Files found

- `desktop/tauri/src-tauri/icons/icon.png` — current 128×128 transparent RGBA native source.
- `desktop/tauri/src-tauri/icons/icon.icns` — current macOS icon container; all iconset members retain transparency.
- `desktop/tauri/src-tauri/tauri.conf.json:16-18` — Tauri bundle icon inputs and macOS bundle settings.
- `desktop/tauri/package.json:10-12,21-24` — pinned Tauri CLI version and app build script.
- `public/brand/logo.webp` — 1024×1024 approved transparent symbol.
- `public/brand/logo-256.png`, `logo-32.png`, `logo-16.png` — approved transparent PNG variants.
- `public/brand/README.md:3-4,15-22` — brand alpha/background and versioning rules.
- `src/lib/brand.ts:1-8` — browser/UI brand references.
- `src/styles.css:49-55` — shared dark surface tokens.
- `.trellis/spec/frontend/desktop-ui.md:37` — shared desktop surface token contract.
- `.trellis/spec/frontend/native-workspace.md` — packaged Tauri/native acceptance boundary.

## External references

- Tauri CLI installed locally: `@tauri-apps/cli@2.12.1`; `tauri icon --help` confirms square PNG/SVG input, `--output`, and manifest/background options.
- macOS `/usr/bin/iconutil` is installed and converts `.icns` to `.iconset` for member inspection.
- macOS `/usr/bin/sips` is installed and reports/derives raster dimensions; it also reproduced the current icon's close relationship to `logo-256.png` at 128×128.

## Related specs

- `.trellis/spec/frontend/desktop-ui.md` — dark surface tokens and shared presentation contract.
- `.trellis/spec/frontend/native-workspace.md` — Tauri packaged-app and acceptance boundaries.
- `public/brand/README.md` — approved logo alpha and black-background usage guidance.

## Caveats / Not Found

- No checked-in icon generation script, manifest, source design file, or documented command was found in the repository history. The native icon artifacts were first added as binary files with the Tauri prototype commit; provenance must be made reproducible as part of the implementation.
- The current `icon.icns` contains multiple sizes but all preserve alpha; changing only `tauri.conf.json` or only an ICNS member will not solve the light-background issue reliably.
- The exact intended dark token was not explicitly named for the app icon. `#0c0c0c` is recommended because it is the documented navigation/outer chrome token and the brand README already treats black as the uniform backdrop; confirm visually against the app shell when implementing.

### CLI path detail confirmed locally

Running the pinned CLI against the current source succeeded when paths are resolved from the package directory (because `pnpm --dir desktop/tauri` changes the command working directory):

```sh
/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm \\
  --dir desktop/tauri exec tauri icon \\
  src-tauri/icons/icon.png \\
  --output /tmp/cuepoint-tauri-icon-test
```

The command emits `icon.png` (512×512), `icon.icns`, and the platform PNG sizes including 128×128 and 128×128@2x. The current repository's 128×128 `icon.png` is therefore a reduced/custom artifact rather than the CLI's default output; regeneration should either accept the standard 512×512 artifact (the Tauri config accepts it) or explicitly pass `--png 128` if keeping the existing size is a deliberate constraint. In either case, feed an opaque black-composited source so every generated macOS member inherits the dark canvas.
