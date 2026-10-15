import type {ReactNode} from "react";
import {cn} from "../../lib/utils";

/** A labeled group with a single neutral surface and separators between its rows. */
export function SettingsGroup({children, title, className}: {
    children: ReactNode;
    title?: ReactNode;
    className?: string
}) {
    return <div className={cn("settings-group", className)}>
        {title ? <h2 className="settings-group-title">{title}</h2> : null}
        <div className="settings-card">{children}</div>
    </div>;
}

export function SettingsRow({title, description, control}: {
    title: ReactNode;
    description?: ReactNode;
    control?: ReactNode
}) {
    return <section className="settings-row">
        <div className="settings-row-copy">
            <h3 className="settings-row-title">{title}</h3>
            {description ? <p className="settings-row-description">{description}</p> : null}
        </div>
        {control ? <div className="settings-row-control">{control}</div> : null}
    </section>;
}
