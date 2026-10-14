import {SCENE_COPY} from "../content/copy";
import type {SceneId} from "./scenes";

// One scene's words. The readable versions (static page, screen-reader copy) render
// everything: heading (`h1`/`h2`), subtitle, narration, points and the "画面" description.
// The stage (`stage`) is a picture: it keeps only the scene label and the one subtitle
// line; title, narration and points stay out of the picture (they are in the readable copy).
export function SceneBody({id, heading, headingId, stage}: {id: SceneId; heading: "h1" | "h2"; headingId?: string; stage?: false} | {id: SceneId; stage: true; heading?: undefined; headingId?: undefined}) {
    const copy = SCENE_COPY[id];
    if (stage) {
        return (
            <>
                <p className="lp-kicker lp-slate">{copy.kicker}</p>
                <p className="lp-stage-subtitle">{copy.subtitle.text}</p>
            </>
        );
    }
    const Heading = heading ?? "h2";
    return (
        <>
            <p className="lp-kicker">{copy.kicker}</p>
            {copy.eyebrow ? <p className="lp-eyebrow">{copy.eyebrow.text}</p> : null}
            <Heading id={headingId} className="lp-scene-title">{copy.title}</Heading>
            <p className="lp-subtitle">{copy.subtitle.text}</p>
            <p className="lp-narration">{copy.narration.text}</p>
            {copy.points.length > 0 ? (
                <ul className="lp-points">
                    {copy.points.map(point => <li key={point.text}>{point.text}</li>)}
                </ul>
            ) : null}
            <p className="lp-caption">{copy.schematic ? copy.caption : `画面：${copy.caption}`}</p>
        </>
    );
}
