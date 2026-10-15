import type {ManualDraftState} from "../../../app/drafts/useManualDraftGuard";
import type {Character, Scene, Prop, VisualStyle} from "../models/assets";
import {patchCharacter, patchScene, patchProp, patchStyle, setCharacterSlot, setSceneSlot, setPropSlot, setStyleSlot} from "../commands/assets";
import {CHARACTER_SLOTS, SCENE_SLOTS, PROP_SLOTS, STYLE_SLOTS} from "../models/slots";
import {EditableGenerationSlot} from "./GenerationSlotCard";
import {AssetTextField} from "./AssetTextField";

export type ReportAssetDraft = (key: string, state: ManualDraftState, discard?: () => void) => void;
type DraftProps = {unavailable: boolean; report: ReportAssetDraft; compact?: boolean};

export function CharacterDetailFields({character, unavailable, report, compact}: {character: Character} & DraftProps) {
    return (
        <div className={compact ? "mt-6 grid items-start gap-6" : "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"}>
                    <div className="grid grid-cols-2 items-start gap-4">
                        {CHARACTER_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={unavailable}
                                onEditorOpenChange={open => report(`slot:${slot.id}`, {dirty: open, pending: open})}
                                key={slot.id}
                                projectId={character.projectId}
                                targetKey={JSON.stringify([character.projectId, "character", character.id, slot.id])}
                                label={slot.label}
                                title={`角色 · ${slot.label}`}
                                variant="asset"
                                slot={character.slots?.[slot.id]}
                                onSave={(value, baseline) => setCharacterSlot(character.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${character.id}:name`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("name", state, discard)}
                            draftKey={`asset:character:${character.id}:name`}
                            label="名称"
                            value={character.name}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${character.id}:bio`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("bio", state, discard)}
                            draftKey={`asset:character:${character.id}:bio`}
                            label="简介"
                            value={character.bio}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {bio: value}, {bio: baseline})}
                            multiline
                        />
                        <AssetTextField
                            key={`${character.id}:appearance`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("appearance", state, discard)}
                            draftKey={`asset:character:${character.id}:appearance`}
                            label="外观说明"
                            value={character.appearance}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {appearance: value}, {appearance: baseline})}
                            multiline
                        />
                        <AssetTextField
                            key={`${character.id}:notes`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("notes", state, discard)}
                            draftKey={`asset:character:${character.id}:notes`}
                            label="备注"
                            value={character.notes}
                            projectId={character.projectId}
                            persist={(value, baseline) => patchCharacter(character.id, {notes: value}, {notes: baseline})}
                            multiline
                        />
                        <details className="border-t pt-4">
                            <summary
                                className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节
                                · 选填
                            </summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">记录人物的行为、目标与声音，让表演前后一致。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${character.id}:personality`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("personality", state, discard)}
                                    draftKey={`asset:character:${character.id}:personality`}
                                    label="性格与行为"
                                    value={character.personality ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {personality: value}, {personality: baseline})}
                                    placeholder="说话习惯、待人方式、面对压力的反应"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${character.id}:motivation`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("motivation", state, discard)}
                                    draftKey={`asset:character:${character.id}:motivation`}
                                    label="动机与目标"
                                    value={character.motivation ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {motivation: value}, {motivation: baseline})}
                                    placeholder="想要什么、害怕什么、行动的原因"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${character.id}:voice`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("voice", state, discard)}
                                    draftKey={`asset:character:${character.id}:voice`}
                                    label="声音与表达"
                                    value={character.voice ?? ""}
                                    projectId={character.projectId}
                                    persist={(value, baseline) => patchCharacter(character.id, {voice: value}, {voice: baseline})}
                                    placeholder="音色、语速、口音与表达习惯"
                                    multiline
                                />
                            </div>
                        </details>
                    </div>
                </div>
    );
}

export function SceneDetailFields({scene, unavailable, report, compact}: {scene: Scene} & DraftProps) {
    return (
        <div className={compact ? "mt-6 grid items-start gap-6" : "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"}>
                    <div className="grid grid-cols-2 items-start gap-4">
                        {SCENE_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={unavailable}
                                onEditorOpenChange={open => report(`slot:${slot.id}`, {dirty: open, pending: open})}
                                key={slot.id}
                                projectId={scene.projectId}
                                targetKey={JSON.stringify([scene.projectId, "scene", scene.id, slot.id])}
                                label={slot.label}
                                title={`场景 · ${slot.label}`}
                                variant="asset"
                                slot={scene.slots?.[slot.id]}
                                onSave={(value, baseline) => setSceneSlot(scene.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${scene.id}:name`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("name", state, discard)}
                            draftKey={`asset:scene:${scene.id}:name`}
                            label="名称"
                            value={scene.name}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:location`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("location", state, discard)}
                            draftKey={`asset:scene:${scene.id}:location`}
                            label="地点"
                            value={scene.location}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {location: value}, {location: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:timeOfDay`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("timeOfDay", state, discard)}
                            draftKey={`asset:scene:${scene.id}:timeOfDay`}
                            label="时段"
                            value={scene.timeOfDay}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {timeOfDay: value}, {timeOfDay: baseline})}
                            placeholder="日 / 夜 / 黄昏"
                        />
                        <AssetTextField
                            key={`${scene.id}:atmosphere`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("atmosphere", state, discard)}
                            draftKey={`asset:scene:${scene.id}:atmosphere`}
                            label="氛围"
                            value={scene.atmosphere}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {atmosphere: value}, {atmosphere: baseline})}
                        />
                        <AssetTextField
                            key={`${scene.id}:notes`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("notes", state, discard)}
                            draftKey={`asset:scene:${scene.id}:notes`}
                            label="备注"
                            value={scene.notes}
                            projectId={scene.projectId}
                            persist={(value, baseline) => patchScene(scene.id, {notes: value}, {notes: baseline})}
                            multiline
                        />
                        <details className="border-t pt-4">
                            <summary
                                className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节
                                · 选填
                            </summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">记录空间与光线，方便安排机位和延续场景氛围。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${scene.id}:geography`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("geography", state, discard)}
                                    draftKey={`asset:scene:${scene.id}:geography`}
                                    label="空间布局"
                                    value={scene.geography ?? ""}
                                    projectId={scene.projectId}
                                    persist={(value, baseline) => patchScene(scene.id, {geography: value}, {geography: baseline})}
                                    placeholder="出入口、动线、主要物件之间的位置关系"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${scene.id}:lighting`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("lighting", state, discard)}
                                    draftKey={`asset:scene:${scene.id}:lighting`}
                                    label="光线设计"
                                    value={scene.lighting ?? ""}
                                    projectId={scene.projectId}
                                    persist={(value, baseline) => patchScene(scene.id, {lighting: value}, {lighting: baseline})}
                                    placeholder="主光来源、方向、冷暖与明暗层次"
                                    multiline
                                />
                            </div>
                        </details>
                    </div>
                </div>
    );
}

export function PropDetailFields({prop, unavailable, report, compact}: {prop: Prop} & DraftProps) {
    return (
        <div className={compact ? "mt-6 grid items-start gap-6" : "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"}>
                    <div className="grid grid-cols-2 items-start gap-4">
                        {PROP_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={unavailable}
                                onEditorOpenChange={open => report(`slot:${slot.id}`, {dirty: open, pending: open})}
                                key={slot.id}
                                projectId={prop.projectId}
                                targetKey={JSON.stringify([prop.projectId, "prop", prop.id, slot.id])}
                                label={slot.label}
                                title={`道具 · ${slot.label}`}
                                variant="asset"
                                slot={prop.slots?.[slot.id]}
                                onSave={(value, baseline) => setPropSlot(prop.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${prop.id}:name`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("name", state, discard)}
                            draftKey={`asset:prop:${prop.id}:name`}
                            label="名称"
                            value={prop.name}
                            projectId={prop.projectId}
                            persist={(value, baseline) => patchProp(prop.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${prop.id}:kind`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("kind", state, discard)}
                            draftKey={`asset:prop:${prop.id}:kind`}
                            label="类型"
                            value={prop.kind}
                            projectId={prop.projectId}
                            persist={(value, baseline) => patchProp(prop.id, {kind: value}, {kind: baseline})}
                            placeholder="衣服、车、物件…"
                        />
                        <AssetTextField
                            key={`${prop.id}:notes`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("notes", state, discard)}
                            draftKey={`asset:prop:${prop.id}:notes`}
                            label="备注"
                            value={prop.notes}
                            projectId={prop.projectId}
                            persist={(value, baseline) => patchProp(prop.id, {notes: value}, {notes: baseline})}
                            multiline
                        />
                        <details className="border-t pt-4">
                            <summary
                                className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节
                                · 选填
                            </summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">记录外观、使用方式和连续性，方便镜头之间保持一致。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${prop.id}:appearance`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("appearance", state, discard)}
                                    draftKey={`asset:prop:${prop.id}:appearance`}
                                    label="外观特征"
                                    value={prop.appearance ?? ""}
                                    projectId={prop.projectId}
                                    persist={(value, baseline) => patchProp(prop.id, {appearance: value}, {appearance: baseline})}
                                    placeholder="形状、颜色、纹理与辨识细节"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${prop.id}:material`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("material", state, discard)}
                                    draftKey={`asset:prop:${prop.id}:material`}
                                    label="材质"
                                    value={prop.material ?? ""}
                                    projectId={prop.projectId}
                                    persist={(value, baseline) => patchProp(prop.id, {material: value}, {material: baseline})}
                                    placeholder="金属、木质、织物，以及表面质感"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${prop.id}:size`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("size", state, discard)}
                                    draftKey={`asset:prop:${prop.id}:size`}
                                    label="尺寸与比例"
                                    value={prop.size ?? ""}
                                    projectId={prop.projectId}
                                    persist={(value, baseline) => patchProp(prop.id, {size: value}, {size: baseline})}
                                    placeholder="实际尺寸或与人物、环境的相对比例"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${prop.id}:usage`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("usage", state, discard)}
                                    draftKey={`asset:prop:${prop.id}:usage`}
                                    label="使用方式"
                                    value={prop.usage ?? ""}
                                    projectId={prop.projectId}
                                    persist={(value, baseline) => patchProp(prop.id, {usage: value}, {usage: baseline})}
                                    placeholder="谁使用、如何拿取、如何参与动作"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${prop.id}:continuity`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("continuity", state, discard)}
                                    draftKey={`asset:prop:${prop.id}:continuity`}
                                    label="连续性要求"
                                    value={prop.continuity ?? ""}
                                    projectId={prop.projectId}
                                    persist={(value, baseline) => patchProp(prop.id, {continuity: value}, {continuity: baseline})}
                                    placeholder="磨损、摆放、状态变化及需保持一致的细节"
                                    multiline
                                />
                            </div>
                        </details>
                    </div>
                </div>
    );
}

export function StyleDetailFields({style, unavailable, report, compact}: {style: VisualStyle} & DraftProps) {
    return (
        <div className={compact ? "mt-6 grid items-start gap-6" : "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"}>
                    <div className="grid grid-cols-2 items-start gap-4">
                        {STYLE_SLOTS.map((slot) => (
                            <EditableGenerationSlot
                                unavailable={unavailable}
                                onEditorOpenChange={open => report(`slot:${slot.id}`, {dirty: open, pending: open})}
                                key={slot.id}
                                projectId={style.projectId}
                                targetKey={JSON.stringify([style.projectId, "style", style.id, slot.id])}
                                label={slot.label}
                                title={`风格 · ${slot.label}`}
                                variant="asset"
                                slot={style.slots?.[slot.id]}
                                onSave={(value, baseline) => setStyleSlot(style.id, slot.id, value, baseline)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 space-y-4">
                        <AssetTextField
                            key={`${style.id}:name`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("name", state, discard)}
                            draftKey={`asset:style:${style.id}:name`}
                            label="名称"
                            value={style.name}
                            projectId={style.projectId}
                            persist={(value, baseline) => patchStyle(style.id, {name: value}, {name: baseline})}
                        />
                        <AssetTextField
                            key={`${style.id}:notes`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("notes", state, discard)}
                            draftKey={`asset:style:${style.id}:notes`}
                            label="备注"
                            value={style.notes}
                            projectId={style.projectId}
                            persist={(value, baseline) => patchStyle(style.id, {notes: value}, {notes: baseline})}
                            multiline
                            placeholder="画风、光色、镜头气质"
                        />
                        <details className="border-t pt-4">
                            <summary
                                className="focus-visible:ring-ring/50 cursor-pointer rounded-md text-sm leading-5 font-semibold focus-visible:outline-none focus-visible:ring-[3px]">创作细节
                                · 选填
                            </summary>
                            <p className="text-muted-foreground mt-2 text-xs leading-5">把色彩、光影与构图方向写清楚，作为整部作品的视觉依据。所有信息均为选填。</p>
                            <div className="mt-4 space-y-4">
                                <AssetTextField
                                    key={`${style.id}:palette`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("palette", state, discard)}
                                    draftKey={`asset:style:${style.id}:palette`}
                                    label="色彩方案"
                                    value={style.palette ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {palette: value}, {palette: baseline})}
                                    placeholder="主色、辅助色、饱和度与色彩关系"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:lighting`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("lighting", state, discard)}
                                    draftKey={`asset:style:${style.id}:lighting`}
                                    label="光影风格"
                                    value={style.lighting ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {lighting: value}, {lighting: baseline})}
                                    placeholder="柔硬、反差、色温与阴影"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:lens`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("lens", state, discard)}
                                    draftKey={`asset:style:${style.id}:lens`}
                                    label="镜头气质"
                                    value={style.lens ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {lens: value}, {lens: baseline})}
                                    placeholder="焦段倾向、景深、畸变与颗粒"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:composition`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("composition", state, discard)}
                                    draftKey={`asset:style:${style.id}:composition`}
                                    label="构图原则"
                                    value={style.composition ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {composition: value}, {composition: baseline})}
                                    placeholder="画面重心、留白、对称与层次"
                                    multiline
                                />
                                <AssetTextField
                                    key={`${style.id}:negativePrompt`}
                            unavailable={unavailable}
                            onDepartureState={(state, discard) => report("negativePrompt", state, discard)}
                                    draftKey={`asset:style:${style.id}:negativePrompt`}
                                    label="避免出现"
                                    value={style.negativePrompt ?? ""}
                                    projectId={style.projectId}
                                    persist={(value, baseline) => patchStyle(style.id, {negativePrompt: value}, {negativePrompt: baseline})}
                                    placeholder="不希望出现的颜色、质感、构图或元素"
                                    multiline
                                />
                            </div>
                        </details>
                    </div>
                </div>
    );
}
