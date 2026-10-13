# Research: Phosphor Replacement

Date: 2026-10-13. Scope: application source plus official Phosphor React documentation/source.

## Confirmed product choice

The user requested uninstalling Remix and trying Phosphor, preferring Fill for activation. Use Regular for ordinary glyphs and Fill for selected navigation; Duotone is not the default. Keep muted ordinary shortcuts and the established compact shell geometry.

## Application boundary

- `package.json:39` pins `@remixicon/react` 4.9.0. Direct package imports occur only in `src/components/ui/remixIcons.tsx` and `src/components/layout/AppFrame.tsx`.
- The semantic adapter exports existing button/action names for general UI consumers. Rename it to a neutral `src/components/ui/icons.tsx` and migrate current imports; do not leave a permanent Remix-named facade.
- `tests/remixIcons.test.ts:9-39` exercises an actual LobeHub native ActionIcon, transparent-fill forwarding, explicit color/size and accessibility. Retain these meaningful integration assertions under the new package geometry instead of replacing them with path snapshots.
- Brand/model marks belong to `@lobehub/icons`; decorative measurement SVG remain feature-owned. `lucide-react` is a development dependency required by immutable historical comparison fixtures. The Remix removal does not authorize modifying those fixture bytes or third-party package internals.

## Official package/API evidence

- [Official React package](https://github.com/phosphor-icons/react): use `@phosphor-icons/react`, not the legacy `phosphor-react`. Each icon accepts a `weight` prop including Regular, Fill and Duotone; it forwards SVG props/ref and supports static imports/tree shaking.
- [Official package manifest](https://raw.githubusercontent.com/phosphor-icons/react/master/package.json): inspected source identifies version 2.1.10, React/ReactDOM >=16.8 peers and public individual CSR import paths. Treat 2.1.10 as the pinned installation candidate, verifying availability before dependency mutation; this is not a claim about the latest registry release.
- [Official IconBase](https://raw.githubusercontent.com/phosphor-icons/react/master/src/lib/IconBase.tsx): default weight is Regular and geometry is 256x256. SVG props are spread after computed fill/viewBox/width/height. Therefore LobeHub's transparent fill, or legacy stroke/viewBox overrides, can still suppress or distort official geometry unless the adapter removes them.
- Prefer static individual CSR imports supported by the pinned package when needed for Vite dev performance; avoid an all-icons runtime dictionary, dynamic name lookup or reading library internals.

## Migration design

Keep the existing semantic exports where they map correctly to official glyphs. Strip inappropriate raw fill/stroke/viewBox overrides at the adapter boundary while preserving color, size, class/style, aria, semantic weight and SVG ref. Selected global navigation uses one official component and switches its weight; Creation Assistant uses House. Keep HeartFill and other intentionally filled semantic cases explicit. Check playback, audio/microphone, library, clipboard/task, shields, arrows and panel-toggle meanings visually rather than preserving a weak mapping merely because the names match.

Install the pinned new package and remove Remix through the user's explicit local pnpm path. Check package.json, pnpm-lock.yaml and production imports for closure; inspect the lockfile diff for unrelated churn. Update current frontend specs after implementation. Archived descriptions/commits are historical and should not be rewritten.

## Required evidence

Actual LobeHub ActionIcon visibility, matched Regular/Fill geometry, explicit color/size/class/aria/ref, disabled/focus and menu behavior; production build and root/native frontend checks. Library SVG screenshots alone do not prove the application integration. No dependency installation or product edits occurred in this research.
