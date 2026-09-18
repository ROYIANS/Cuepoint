import type { Project, Prop, Shot, VisualStyle } from "@/domain/types";

/** Resolve names at read time so inherited styles track the project default. */
export function shotRelations(
  project: Project,
  shot: Shot,
  props: Prop[],
  styles: VisualStyle[],
) {
  const propNames = new Map(props.filter((item) => item.projectId === project.id).map((item) => [item.id, item.name]));
  const styleId = shot.styleId === undefined ? project.defaultStyleId : shot.styleId;
  const style = styles.find((item) => item.projectId === project.id && item.id === styleId);
  return {
    props: (shot.propIds ?? []).map((id) => propNames.get(id) ?? `未知道具(${id})`).join("、"),
    style: styleId ? (style?.name || `未知风格(${styleId})`) : "无风格",
    styleSource: shot.styleId === undefined ? "继承项目" : shot.styleId === null ? "不使用风格" : "镜头指定",
  };
}
