import { lazy, Suspense, type ComponentProps } from "react";
import type { ModelIcon as LobeModelIcon, ProviderIcon as LobeProviderIcon } from "@lobehub/icons";

// Dynamic model/provider matching includes the full vendor icon catalog. Load it
// only for an actual model chip or an opened provider picker, never the empty home.
const LazyModelIcon = lazy(() => import("./ModelIconCatalog").then((module) => ({ default: module.ModelIcon })));
const LazyProviderIcon = lazy(() => import("./ModelIconCatalog").then((module) => ({ default: module.ProviderIcon })));

function Placeholder({ size = 12 }: { size?: number }) {
  return <span aria-hidden style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }} />;
}

export function ModelIcon(props: ComponentProps<typeof LobeModelIcon>) {
  return <Suspense fallback={<Placeholder size={props.size} />}><LazyModelIcon {...props} /></Suspense>;
}

export function ProviderIcon(props: ComponentProps<typeof LobeProviderIcon>) {
  return <Suspense fallback={<Placeholder size={props.size} />}><LazyProviderIcon {...props} /></Suspense>;
}
