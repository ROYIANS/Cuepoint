// The film is seven scenes. Six are "stage" scenes: they share one pinned
// 100svh stage and are driven by scroll progress. The closing credits are a
// "flow" scene: they hold interactive content (download, links, FAQ) of
// arbitrary height, so they render as ordinary document flow after the stage
// is released instead of inside a nested scroller. Flow scenes carry weight 0
// and are excluded from TOTAL_WEIGHT; the timeline therefore only maps the
// stage scenes. Flow scenes must stay last so a stage scene's index in
// STAGE_SCENES equals its index in SCENES.
export type SceneId = "leader" | "spark" | "script" | "agent" | "vault" | "delivery" | "credits";

export type Scene = {
    readonly id: SceneId;
    /** Scene name, used for headings and the reading order. */
    readonly title: string;
    /** Short label for the HUD. */
    readonly short: string;
    /** Share of the film's scroll length; 0 for flow scenes. */
    readonly weight: number;
    readonly flow?: true;
};

export const SCENES: readonly Scene[] = [
    {id: "leader", title: "片头", short: "片头", weight: 1.1},
    {id: "spark", title: "灵感 → 剧本", short: "灵感", weight: 1},
    {id: "script", title: "剧本 → 分镜", short: "分镜", weight: 1.2},
    {id: "agent", title: "创作助手", short: "助手", weight: 1.2},
    {id: "vault", title: "本机优先", short: "本机", weight: 1},
    {id: "delivery", title: "成片与交付", short: "交付", weight: 1},
    {id: "credits", title: "片尾字幕", short: "片尾", weight: 0, flow: true},
];

export const STAGE_SCENES: readonly Scene[] = SCENES.filter(scene => !scene.flow);

/** Total weight of the stage scenes; also the film container height in viewports. */
export const TOTAL_WEIGHT: number = STAGE_SCENES.reduce((sum, scene) => sum + scene.weight, 0);
