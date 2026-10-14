import {IconControl} from "../ui/IconControl";

// Toggles between the film and the plain stacked page. The choice is remembered
// by useFilmMode (localStorage, failures ignored). Icon-only: the label carries
// the state (跳过动画 / 观看动画) for assistive technology and the CSS tooltip.
export function SkipButton({skipped, onToggle}: {skipped: boolean; onToggle: () => void}) {
    return <IconControl icon={skipped ? "play" : "skip"} label={skipped ? "观看动画" : "跳过动画"} reveal="tip" umami={skipped ? "play-animation" : "skip-animation"} onClick={onToggle} />;
}
