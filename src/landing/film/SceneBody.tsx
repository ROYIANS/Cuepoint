import {SCENE_COPY} from "../content/copy";
import type {SceneId} from "./scenes";

// One scene's words. `heading` is a real heading in the readable (static and
// screen-reader) versions and a plain paragraph on the decorative stage. The
// "画面" description is for the readable versions only: on the stage the picture
// itself (the Canvas) says it, so `stage` leaves the caption out.
export function SceneBody({id, heading, headingId, stage}: {id: SceneId; heading: "h1" | "h2" | "p"; headingId?: string; stage?: boolean}) {
    const copy = SCENE_COPY[id];
    const Heading = heading;
    return (
        <>
            <p className="lp-kicker">{copy.kicker}</p>
            {copy.eyebrow ? <p className="lp-eyebrow">{copy.eyebrow.text}</p> : null}
            <Heading id={headingId} className="lp-scene-title">{copy.title}</Heading>
            <p className="lp-narration">{copy.narration.text}</p>
            {copy.points.length > 0 ? (
                <ul className="lp-points">
                    {copy.points.map(point => <li key={point.text}>{point.text}</li>)}
                </ul>
            ) : null}
            {stage ? null : <p className="lp-caption">{copy.schematic ? copy.caption : `画面：${copy.caption}`}</p>}
        </>
    );
}
