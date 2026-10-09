import {describe, expect, it} from "vitest";
import {db} from "@/db/database";
import {createProject} from "@/db/projects";
import {firstEpisode} from "@/db/episodes";
import {addShot, patchShot} from "@/db/shots";
import {deriveEpisodeDelivery, episodeDeliveryCsv, escapeCsvCell} from "@/lib/episodeDelivery";

it("E07 exports all seven authored extra columns with unchanged base fields and CSV escaping", async () => {
    const project = await createProject("CSV"), episode = (await firstEpisode(project.id))!;
    const shot = await addShot(project.id, episode.id);
    const extras = {category: '分类,"原文"', sound: "声音\r\n原文", emotion: " 情绪 ", cameraAngle: "俯角", cameraGear: "三脚架", focalLength: "35mm", sceneCloseup: "特写"};
    await patchShot(shot.id, {...extras, content: '内容,"对白"\n下一行', notes: "备注\r\n原文", durationSec: 2.5});
    const saved = (await db.shots.get(shot.id))!;
    const delivery = deriveEpisodeDelivery({project: {...project, columnSettings: {visible: ["content", "durationSec", "characters", "scene", "notes", "category", "sound", "emotion", "cameraAngle", "cameraGear", "focalLength", "sceneCloseup"]}}, episode, shots: [saved], characters: [], scenes: [], props: [], styles: [], media: new Map()});
    expect(delivery.columns.map(column => column.id).sort()).toEqual(Object.keys(extras).sort());
    expect(delivery.rows[0].values).toEqual(extras);
    const csv = episodeDeliveryCsv(delivery);
    expect(csv.startsWith("\uFEFF顺序,镜号,状态,场次,内容,时长(秒)")).toBe(true);
    expect(csv).toContain('"内容,""对白""\n下一行",2.5');
    expect(csv).toContain('"备注\r\n原文"');
    expect(csv).toContain('"分类,""原文"""');
    expect(csv).toContain('"声音\r\n原文"');
    expect(csv).not.toContain("[object Object]");
});

describe("E07 scalar CSV cell contract", () => {
    it.each([[undefined, ""], [null, ""], [0, "0"], [2.5, "2.5"], ["", ""], ['引号"', '"引号"""'], ["a,b", '"a,b"'], ["a\nb", '"a\nb"'], ["a\rb", '"a\rb"']])("serializes actual delivery scalar %j", (input, expected) => {
        expect(escapeCsvCell(input)).toBe(expected);
    });
});
