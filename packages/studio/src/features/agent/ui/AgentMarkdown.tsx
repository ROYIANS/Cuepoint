import {Markdown} from "@lobehub/ui";
import {type ComponentProps, useMemo} from "react";
import {useShotDetailActivation} from "../../../app/details/ShotDetails";

/** Publisher anchor customization retains citation/footnote rendering and rich lazy boundaries. */
export function AgentMarkdown(props: Omit<ComponentProps<typeof Markdown>, "componentProps">) {
    const activate = useShotDetailActivation();
    const components = useMemo(() => ({a: {onClick: (event: React.MouseEvent<HTMLElement>) => activate(event)}}), [activate]);
    return <Markdown {...props} componentProps={components}/>;
}
