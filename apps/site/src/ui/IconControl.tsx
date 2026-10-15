import type {ReactNode} from "react";

const ICONS = {
    // Arrow out of a frame: leave the page for the app.
    enter: <path d="M7 17 17 7M9 7h8v8"/>,
    // Fast-forward to the end of the reel.
    skip: <path d="M5 6.5 12 12l-7 5.5zM13 6.5 20 12l-7 5.5z"/>,
    // Play: bring the animation back.
    play: <path d="M8 5.5v13l11-6.5z"/>,
    pause: <path d="M8 5.5v13M16 5.5v13"/>,
    // Replay: an arrow closing a circle.
    replay: <path d="M5 12a7 7 0 1 0 2.2-5.1M5 4.5v4h4"/>,
    star: <path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>,
} as const;

type IconName = keyof typeof ICONS;

function Icon({name}: { name: IconName }): ReactNode {
    return (
        <svg className="lp-ic-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {ICONS[name]}
        </svg>
    );
}

type Common = {
    icon: IconName;
    /** The control's name. Where it is not shown as text it becomes aria-label. */
    label: string;
    umami: string;
    /** hover: the label slides out on hover/focus; tip: a CSS tooltip; always: the label is plain visible text; none: icon only, no tooltip. */
    reveal: "hover" | "tip" | "always" | "none";
    className?: string;
};

type Props = Common & ({ href: string; rel?: string; onClick?: undefined } | {
    onClick: () => void;
    href?: undefined;
    rel?: undefined
});

// One round, glassy icon control for every header action (link or button), so
// both are guaranteed the same size, edge, shadow and focus treatment.
export function IconControl({icon, label, umami, reveal, className, href, rel, onClick}: Props) {
    const classes = ["lp-ic", `lp-ic-${reveal}`, className].filter(Boolean).join(" ");
    const body = (
        <>
            {reveal === "hover" || reveal === "always" ? <span className="lp-ic-label">{label}</span> : null}
            <Icon name={icon}/>
        </>
    );
    const named = reveal === "always" ? {} : {"aria-label": label};
    if (href !== undefined) {
        return <a className={classes} href={href} rel={rel} title={reveal === "hover" ? label : undefined}
                  data-umami-event={umami} {...named}>{body}</a>;
    }
    return <button type="button" className={classes} onClick={onClick} data-tip={reveal === "tip" ? label : undefined}
                   data-umami-event={umami} {...named}>{body}</button>;
}
