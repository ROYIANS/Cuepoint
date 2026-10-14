// Toggles between the film and the plain stacked page. The choice is remembered
// by useFilmMode (localStorage, failures ignored).
export function SkipButton({skipped, onToggle}: {skipped: boolean; onToggle: () => void}) {
    return (
        <button type="button" className="lp-btn lp-btn-quiet lp-skip-film" onClick={onToggle} data-umami-event={skipped ? "play-animation" : "skip-animation"}>
            {skipped ? "观看动画" : "跳过动画"}
        </button>
    );
}
