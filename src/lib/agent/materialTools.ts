import { db } from '@/db/database';
import { promoteLegacyMaterial, promoteMaterial, updateMaterialMetadata, useMaterialInProject, updateMaterialUse, setMaterialArchived } from '@/db/materials';
import { releaseMaterialUse } from '@/db/repo';
import type { LibraryMaterial, MaterialEntity, MaterialScope, MaterialUse, MaterialVersion, SettingMaterialKind } from '@/domain/materials';
import { STUDIO_LIBRARY_ID } from '@/domain/types';
import type { AgentToolContext, AgentToolDefinition } from './tools';
import { array, bool, choice, id, nonempty, number, object, optional, text } from './businessSchemas';
import { libraryReadTool, libraryWriteTool } from './libraryToolHelpers';
import { assertActiveMaterialScope, assertMaterialAccess, readMaterialText } from './materialContent';
import { frozenProjectScope } from './projectScope';
import { queueMaterialImage } from './materialImageInput';
export { MATERIAL_TOOL_NAMES } from './materialToolNames';

const kind = choice(['image', 'video', 'audio', 'document', 'character', 'scene', 'prop', 'style']);
const settingKind = choice(['media', 'character', 'scene', 'prop', 'style']);
const revision = number(1, Number.MAX_SAFE_INTEGER, true);
const paging = { offset: optional(number(0, 100000, true)), limit: optional(number(1, 20, true)) };
const scopeBase = object({ kind: choice(['global', 'ip', 'project']), id: optional(id) });
const scopeSpec = { ...scopeBase, schema: scopeBase.schema.refine(value => value.kind === 'global' ? !value.id : !!value.id, 'global 不填 id；ip/project 必须填所属 id') };
const identity = { materialId: id, revision };
const scoped = (value: { kind: 'global' | 'ip' | 'project'; id?: string }): MaterialScope => value.kind === 'global' ? { kind: 'global' } : { kind: value.kind, id: value.id! };
const sameScope = (a: MaterialScope, b: MaterialScope) => a.kind === b.kind && (a.kind === 'global' || b.kind !== 'global' && a.id === b.id);
function settingTable(type: SettingMaterialKind) {
  return type === 'character' ? db.characters : type === 'scene' ? db.scenes : type === 'prop' ? db.props : db.styles;
}
function materialSummary(row: LibraryMaterial) {
  return { id: row.id, name: row.name, kind: row.kind, scope: row.scope, revision: row.revision, archived: row.archived, tags: row.tags.slice(0, 12), notes: row.notes.slice(0, 400), source: row.source };
}
function versionSummary(version: MaterialVersion) {
  const payload = version.payload;
  return { revision: version.revision, createdAt: version.createdAt, ...(payload.type === 'file'
    ? { filename: payload.filename, mimeType: payload.mimeType, size: payload.blob.size }
    : { kind: payload.kind, entityId: payload.entity.id, mediaCount: payload.media.length, media: payload.media.slice(0, 20).map(item => ({ mediaId: item.id, filename: item.filename, mimeType: item.mimeType, size: item.blob.size })) }) };
}
function settingSummary(entity: MaterialEntity) {
  const fields = Object.fromEntries(Object.entries(entity).filter(([key, value]) => !['extra', 'slots'].includes(key) && typeof value === 'string').map(([key, value]) => [key, (value as string).slice(0, 1200)]));
  return { ...fields, slotCount: Object.keys(entity.slots).length, truncatedFields: Object.entries(entity).filter(([, value]) => typeof value === 'string' && value.length > 1200).map(([key]) => key), slots: Object.fromEntries(Object.entries(entity.slots).slice(0, 10).map(([slot, value]) => [slot, value ? { referenceImageIds: value.referenceImageIds.slice(0, 5), referenceVideoIds: value.referenceVideoIds.slice(0, 5), referenceImageCount: value.referenceImageIds.length, referenceVideoCount: value.referenceVideoIds.length, result: value.result } : null])) };
}
async function currentMaterial(materialId: string, context: AgentToolContext, expected?: number) {
  const material = await db.libraryMaterials.get(materialId);
  if (!material) throw new Error('素材不存在，请先搜索取得准确 ID');
  await assertMaterialAccess(material, context);
  if (expected !== undefined && material.revision !== expected) throw new Error(`素材已更新到 v${material.revision}，请重新读取后使用当前 revision 提出修改`);
  return material;
}
async function activeMaterial(materialId: string, expected: number, context: AgentToolContext) {
  const material = await currentMaterial(materialId, context, expected);
  if (material.archived) throw new Error('素材已归档，请先恢复');
  await assertActiveMaterialScope(material.scope);
  return material;
}
async function scopeState(scope: MaterialScope) {
  if (scope.kind === 'global') return scope;
  return scope.kind === 'ip' ? { scope, owner: await db.ipProfiles.get(scope.id) } : { scope, owner: await db.projects.get(scope.id), link: await db.projectIpLinks.get(scope.id) };
}
async function destinationScope(scope: MaterialScope, context: AgentToolContext) {
  await assertMaterialAccess({ scope }, context);
  await assertActiveMaterialScope(scope);
  return scopeState(scope);
}
async function targetProject(projectId: string, context: AgentToolContext) {
  const bound = await frozenProjectScope(context);
  if (bound && bound !== projectId) throw new Error('项目绑定对话只能将素材加入或移除当前项目；请切换到目标项目对话');
  const project = await db.projects.get(projectId);
  if (!project || project.archivedAt) throw new Error('目标项目不存在或已归档');
  return { project, link: await db.projectIpLinks.get(projectId) };
}
async function usages(materialId: string, context: AgentToolContext) {
  const all = await db.materialUses.where('materialId').equals(materialId).toArray();
  const projectId = await frozenProjectScope(context);
  return { all, visible: projectId ? all.filter(use => use.projectId === projectId) : all };
}
async function sourceLegacy(type: 'media' | SettingMaterialKind, sourceId: string, context: AgentToolContext) {
  const row = type === 'media' ? await db.media.get(sourceId) : await settingTable(type).get(sourceId);
  if (!row) throw new Error('原始素材或设定不存在，请先搜索原始资料取得准确 ID');
  const scope: MaterialScope = row.projectId === STUDIO_LIBRARY_ID ? { kind: 'global' } : { kind: 'project', id: row.projectId };
  await assertMaterialAccess({ scope }, context);
  await assertActiveMaterialScope(scope);
  if ('blob' in row) return { row, state: { id: row.id, projectId: row.projectId, filename: row.filename, mimeType: row.mimeType, size: row.blob.size } };
  const ids = new Set(Object.values(row.slots).flatMap(slot => slot ? [...slot.referenceImageIds, ...slot.referenceVideoIds, ...(slot.result ? [slot.result.mediaId] : [])] : []));
  const media = await db.media.bulkGet([...ids]);
  return { row, state: { entity: row, media: media.map(item => item ? { id: item.id, projectId: item.projectId, filename: item.filename, mimeType: item.mimeType, size: item.blob.size } : null) } };
}
const materialTarget = (material: LibraryMaterial) => ({ label: material.name, href: '/assets' });
async function scopeLabel(scope: MaterialScope) {
  if (scope.kind === 'global') return '通用素材（跨项目共享）';
  const owner = scope.kind === 'ip' ? await db.ipProfiles.get(scope.id) : await db.projects.get(scope.id);
  return `${scope.kind === 'ip' ? 'IP 专属' : '项目专属'}「${owner?.name ?? '已删除'}」(${scope.id})`;
}
/** The adopted copy belongs to its project even after access to its source is withdrawn. */
async function projectUseState(useId: string, context: AgentToolContext) {
  const use = await db.materialUses.get(useId);
  if (!use) throw new Error('使用记录不存在，请先读取素材用途');
  const project = await targetProject(use.projectId, context);
  const target = use.targetKind === 'media' ? await db.media.get(use.targetId) : await settingTable(use.targetKind).get(use.targetId);
  if (target && target.projectId !== use.projectId) throw new Error('素材副本归属已变化，请重新核对项目资料');
  const targetState = target && 'blob' in target ? { id: target.id, projectId: target.projectId, filename: target.filename, size: target.blob.size, mimeType: target.mimeType } : target;
  return { use, project, target: targetState };
}
async function useState(useId: string, context: AgentToolContext) {
  const state = await projectUseState(useId, context);
  return { ...state, material: await currentMaterial(state.use.materialId, context) };
}
function useResult(use: MaterialUse) { return { use, note: '项目固定采用此版本的独立副本；不会自动替换镜头、封面或设定中的引用。' }; }

const searchSpec = object({ query: text(300), kind: optional(kind), scope: optional(scopeSpec), includeArchived: optional(bool), source: optional(choice(['library', 'legacy'])), legacyKind: optional(settingKind), ...paging });
const readSpec = object({ materialId: id, revision: optional(revision), ...paging });
const textSpec = object({ ...identity, start: optional(number(0, 100000, true)), limit: optional(number(1, 3, true)) });
const imageSpec = object({ ...identity, mediaId: optional(id) });
const promoteBase = object({ source: choice(['library', 'media', 'character', 'scene', 'prop', 'style']), sourceId: id, expectedRevision: optional(revision), scope: scopeSpec });
const promoteSpec = { ...promoteBase, schema: promoteBase.schema.refine(value => value.source !== 'library' || value.expectedRevision !== undefined, '复制版本素材必须提供 expectedRevision；先读取素材详情') };

export const MATERIAL_TOOLS: readonly AgentToolDefinition[] = [
  libraryReadTool({ name: 'material_search', title: '查找素材', description: '搜索版本素材元信息，默认不含归档。scope 可选 global/ip/project；绑定对话只能读通用、关联 IP 和当前项目。source=legacy 时搜索已有原始 media/角色/场景/道具/风格，须给 legacyKind，默认当前项目或工作室。仅列标题、类型、版本等，不代表已读图片或文档。', spec: searchSpec,
    async execute(args, context) {
      const bound = await frozenProjectScope(context), query = args.query.trim().toLocaleLowerCase(), offset = args.offset ?? 0, limit = args.limit ?? 10;
      if (args.source === 'legacy') {
        if (!args.legacyKind) throw new Error('搜索原始资料须提供 legacyKind：media/character/scene/prop/style');
        const requested = args.scope ? scoped(args.scope) : undefined;
        if (requested?.kind === 'ip') throw new Error('旧版原始资料没有 IP 归属；请搜索 library 中的 IP 素材');
        const owner = requested?.kind === 'project' ? requested.id : requested?.kind === 'global' ? STUDIO_LIBRARY_ID : bound ?? STUDIO_LIBRARY_ID;
        await assertMaterialAccess({ scope: owner === STUDIO_LIBRARY_ID ? { kind: 'global' } : { kind: 'project', id: owner } }, context);
        const rows = args.legacyKind === 'media' ? await db.media.where('projectId').equals(owner).toArray() : await settingTable(args.legacyKind).where('projectId').equals(owner).toArray();
        const matches = rows.filter(row => ('filename' in row ? row.filename : row.name).toLocaleLowerCase().includes(query));
        return { source: 'legacy', total: matches.length, nextOffset: offset + limit < matches.length ? offset + limit : null, items: matches.slice(offset, offset + limit).map(row => 'blob' in row ? { sourceId: row.id, source: 'media', projectId: owner, filename: row.filename, mimeType: row.mimeType, size: row.blob.size } : { sourceId: row.id, source: args.legacyKind, projectId: owner, name: row.name }), note: '原始资料不是版本素材；material_promote 明确归属并确认后可保存独立快照。' };
      }
      const ip = bound ? (await db.projectIpLinks.get(bound))?.ipId : undefined;
      const requested = args.scope ? scoped(args.scope) : undefined;
      if (requested) await assertMaterialAccess({ scope: requested }, context);
      const matches = await db.libraryMaterials.filter(row => (!row.archived || !!args.includeArchived) && (!args.kind || row.kind === args.kind) && (!requested || sameScope(row.scope, requested)) && (!bound || row.scope.kind === 'global' || row.scope.kind === 'project' && row.scope.id === bound || row.scope.kind === 'ip' && row.scope.id === ip) && `${row.name} ${row.tags.join(' ')} ${row.notes}`.toLocaleLowerCase().includes(query)).toArray();
      matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { total: matches.length, items: matches.slice(offset, offset + limit).map(materialSummary), nextOffset: offset + limit < matches.length ? offset + limit : null, note: '搜索结果只有元信息；查看图片/正文需调用对应读取工具。' };
    },
  }),
  libraryReadTool({ name: 'material_read', title: '读取素材详情与用途', description: '读取精确素材 ID、指定历史 revision 的文件元信息/设定摘要；分页列出版本、项目使用记录。不会读取图片像素、音视频或文档正文。返回的是当前名称/标签/备注，旧版本保持独立内容。', spec: readSpec,
    async execute(args, context) {
      const material = await currentMaterial(args.materialId, context);
      const version = await db.materialVersions.where('[materialId+revision]').equals([material.id, args.revision ?? material.revision]).first();
      if (!version) throw new Error('素材版本不存在');
      let contentAvailable = !material.archived;
      if (contentAvailable) { try { await assertActiveMaterialScope(material.scope); } catch { contentAvailable = false; } }
      const allVersions = await db.materialVersions.where('materialId').equals(material.id).reverse().sortBy('revision');
      const uses = await usages(material.id, context), offset = args.offset ?? 0, limit = args.limit ?? 10;
      return { material: { ...materialSummary(material), notes: material.notes.slice(0, 4000), tags: material.tags, notesTruncated: material.notes.length > 4000 }, content: versionSummary(version), contentAvailable, ...(contentAvailable && version.payload.type === 'setting' ? { setting: settingSummary(version.payload.entity) } : {}), versions: allVersions.slice(offset, offset + limit).map(item => ({ revision: item.revision, createdAt: item.createdAt })), versionCount: allVersions.length, uses: uses.visible.slice(offset, offset + limit), usageCount: uses.all.length, visibleUsageCount: uses.visible.length, nextOffset: offset + limit < Math.max(allVersions.length, uses.visible.length) ? offset + limit : null, note: '共享素材修改会影响库的当前版本；已采用的项目副本仍固定旧版本。音视频仅返回元信息，未观看或听取内容。' };
    },
  }),
  { name: 'material_read_text', title: '读取素材文档片段', description: '按 materialId/revision 读取 TXT、Markdown、文字型 PDF、DOCX。start 从 0 开始，每次最多 3 段/12000 字。提取范围、原始行/页/段和 citation 随结果返回；partial 或 hasMore 时不能声称已读全文。仅库内文件，无任意路径/URL读取。', parameters: textSpec.json, effect: 'read', highRisk: () => false, parseArguments: raw => textSpec.schema.parse(raw), execute: (raw, context) => readMaterialText(textSpec.schema.parse(raw), context) },
  { name: 'material_read_image', title: '查看版本素材图片', description: '将 materialId/revision 对应图片的真实像素加入当前视觉模型的下一次请求。设定素材须明确 mediaId。queued 仅表示待发送，尚未完成视觉分析；不调用其他模型，不看音视频。', parameters: imageSpec.json, effect: 'read', highRisk: () => false, parseArguments: raw => imageSpec.schema.parse(raw), execute: (raw, context) => { const args = imageSpec.schema.parse(raw); return queueMaterialImage(args.materialId, args.revision, context, args.mediaId); } },
  libraryWriteTool({ name: 'material_update_metadata', title: '整理素材名称、标签和备注', description: '修改版本素材的名称、标签、备注；revision 必须等于当前版本。产生新版本，原项目副本不变。共享/IP 素材会影响以后采用者，必须确认。', spec: object({ ...identity, patch: nonempty(object({ name: optional(text(300, 1)), tags: optional(array(text(100, 1), 50)), notes: optional(text(20000)) })) }), requiresConfirmation: true,
    async prepare(args, context) {
      const material = await activeMaterial(args.materialId, args.revision, context), usage = await usages(material.id, context);
      return { state: { material, uses: usage.all, scope: await scopeState(material.scope) }, target: materialTarget(material), changes: [`${material.name} · ${await scopeLabel(material.scope)} · v${material.revision} → v${material.revision + 1}`, ...Object.entries(args.patch).map(([key, value]) => `${key === 'name' ? '名称' : key === 'tags' ? '标签' : '备注'}：${(Array.isArray(value) ? value.join('、') : value).slice(0, 1800)}${(Array.isArray(value) ? value.join('、') : value).length > 1800 ? '…（完整内容见参数）' : ''}`), `现有 ${usage.all.length} 条采用记录保持原版本；此修改只影响素材库及以后采用。`] };
    },
    async execute(args) { await updateMaterialMetadata(args.materialId, args.patch, args.revision); return { material: materialSummary((await db.libraryMaterials.get(args.materialId))!) }; },
  }),
  libraryWriteTool({ name: 'material_promote', title: '保存独立版本素材', description: '将已有原始 media/设定或库素材快照复制到明确 global/ip/project 归属。library 来源必须传 expectedRevision。保留来源及独立版本；正式 IP 形象、表情包等必须由用户确认，不能自行把候选视为正式内容。', spec: promoteSpec, requiresConfirmation: true,
    scope: async (args, context) => { await destinationScope(scoped(args.scope), context); if (args.source !== 'library') await sourceLegacy(args.source, args.sourceId, context); else await activeMaterial(args.sourceId, args.expectedRevision!, context); },
    owners: async args => { if (args.source === 'library') return []; const row = args.source === 'media' ? await db.media.get(args.sourceId) : await settingTable(args.source).get(args.sourceId); return row ? [row.projectId] : []; },
    async prepare(args, context) {
      const destination = scoped(args.scope), target = await destinationScope(destination, context);
      const legacy = args.source === 'library' ? undefined : await sourceLegacy(args.source, args.sourceId, context);
      const library = args.source === 'library' ? await activeMaterial(args.sourceId, args.expectedRevision!, context) : undefined;
      const source = library ?? legacy!.state;
      const name = library?.name ?? (legacy && ('name' in legacy.row ? legacy.row.name : legacy.row.filename));
      return { state: { source, target }, changes: [`来源：「${name}」· ${args.source} · ${args.sourceId}${args.expectedRevision ? ` · v${args.expectedRevision}` : ''}`, `保存到：${await scopeLabel(destination)}`, '创建独立快照，保留来源；不会移动、改写原始内容，也不会更新已有项目。', ...(destination.kind === 'ip' ? ['请确认这份内容可以作为该 IP 的正式专属素材。'] : [])] };
    },
    async execute(args) { const material = args.source === 'library' ? await promoteMaterial(args.sourceId, scoped(args.scope)) : await promoteLegacyMaterial(args.source, args.sourceId, scoped(args.scope)); return { material: materialSummary(material) }; },
  }),
  libraryWriteTool({ name: 'material_use', title: '将素材副本加入项目', description: '按当前 revision 将素材独立副本加入明确 projectId，绑定对话只能当前项目。IP 素材须同一 IP；项目素材须同一项目。固定采用版本，不自动放入镜头、封面或生成槽位。', spec: object({ ...identity, projectId: id }), scope: async (args, context) => { await targetProject(args.projectId, context); }, owners: args => [args.projectId],
    async prepare(args, context) {
      const material = await activeMaterial(args.materialId, args.revision, context), project = await targetProject(args.projectId, context);
      if (material.scope.kind === 'project' && material.scope.id !== args.projectId || material.scope.kind === 'ip' && material.scope.id !== project.link?.ipId) throw new Error('素材归属与目标项目不兼容；IP 素材需同一 IP，项目素材需同一项目。可先明确确认保存为通用素材');
      return { state: { material, project, uses: await db.materialUses.where('[materialId+projectId]').equals([material.id, args.projectId]).toArray() }, target: materialTarget(material), changes: [`${material.name} v${material.revision} → 项目「${project.project.name}」`, '创建或复用当前版本副本，保留来源；已有镜头、封面和设定引用不变。'] };
    },
    async execute(args) { return useResult(await useMaterialInProject(args.materialId, args.projectId)); },
  }),
  libraryWriteTool({ name: 'material_update_use', title: '向项目加入新版素材副本', description: '给 useId 所属项目加入库中当前 revision 的新副本。旧副本和镜头引用保留；有本地修改的设定不能覆盖。此工具不替换原镜头或封面引用。', spec: object({ useId: id, revision }), scope: async (args, context) => { await useState(args.useId, context); }, owners: async args => { const use = await db.materialUses.get(args.useId); return use ? [use.projectId] : []; },
    async prepare(args, context) { const state = await useState(args.useId, context); await activeMaterial(state.material.id, args.revision, context); return { state, target: materialTarget(state.material), changes: [`${state.material.name}：项目 v${state.use.revision} → 新增 v${args.revision} 副本`, `目标项目：${state.project.project.name}`, '旧副本、镜头/封面引用保持不变；新副本需要明确选用。'] }; },
    async execute(args) { return useResult(await updateMaterialUse(args.useId)); },
  }),
  libraryWriteTool({ name: 'material_archive', title: '归档或恢复素材', description: '按当前 revision 显式归档/恢复素材。归档后不可再读取内容或采用，既有项目副本保留；恢复需有效归属。不会永久删除。共享素材影响后续创作，必须确认。', spec: object({ ...identity, archived: bool }), requiresConfirmation: true,
    async prepare(args, context) { const material = await currentMaterial(args.materialId, context, args.revision); if (!args.archived) await assertActiveMaterialScope(material.scope); const usage = await usages(material.id, context); return { state: { material, uses: usage.all, scope: await scopeState(material.scope) }, target: materialTarget(material), changes: [`${args.archived ? '归档' : '恢复'}「${material.name}」· ${await scopeLabel(material.scope)}`, `${usage.all.length} 条项目采用记录及其固定版本副本保留。`, args.archived ? '后续不可再查看内容或加入项目，可以恢复。' : '恢复后可再次查看与采用。'] }; },
    async execute(args) { await setMaterialArchived(args.materialId, args.archived); return { material: materialSummary((await db.libraryMaterials.get(args.materialId))!) }; },
  }),
  libraryWriteTool({ name: 'material_release', title: '移除未使用的项目素材副本', description: '按 useId 移除项目中已闲置的采用记录及文件副本。仍被封面、镜头、设定或任务历史引用时拒绝；创作设定须先通过原有工具删除。素材库原版本与其他项目不受影响。', spec: object({ useId: id }), highRisk: true, scope: async (args, context) => { await projectUseState(args.useId, context); }, owners: async args => { const use = await db.materialUses.get(args.useId); return use ? [use.projectId] : []; },
    async prepare(args, context) {
      const state = await projectUseState(args.useId, context);
      const name = state.target ? ('filename' in state.target ? state.target.filename : state.target.name) : '素材副本';
      return { state, target: { label: state.project.project.name, href: `/p/${encodeURIComponent(state.use.projectId)}` }, changes: [`移除项目「${state.project.project.name}」中「${name}」v${state.use.revision} 的闲置副本`, `来源记录：${state.use.materialId}；只移除本项目副本，不重新读取来源素材。`, '保留素材库版本与其他项目；存在实际引用时将拒绝，不会强制移除。'] };
    },
    async execute(args) { await releaseMaterialUse(args.useId); return { released: true, useId: args.useId, note: '已移除闲置项目副本，素材库原版本保留。' }; },
  }),
];
