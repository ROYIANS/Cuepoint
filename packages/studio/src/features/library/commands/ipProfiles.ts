import type {ProductStore} from "../../../platform/storage/types";
import {db as productDb} from '../../../platform/product/store';
import type {IpProfile, IpProfileInput} from '../models/materials';
import {createId, nowIso} from '../../../platform/identity';

const fields = ['name', 'positioning', 'audience', 'topics', 'expression', 'visual', 'voice'] as const;

function textPatch(input: Partial<IpProfileInput>): Partial<IpProfileInput> {
    const patch: Partial<IpProfileInput> = {};
    for (const key of fields) if (input[key] !== undefined) {
        const value = input[key];
        if (typeof value !== 'string' || value.length > (key === 'name' ? 300 : 20_000)) throw new Error('IP 档案内容无效或过长');
        patch[key] = value.trim();
    }
    if (patch.name !== undefined && !patch.name) throw new Error('请填写 IP 名称');
    return patch;
}

export async function createIpProfile(input: IpProfileInput, store?: ProductStore): Promise<IpProfile> {
    const db = store ?? productDb;
    const patch = textPatch(input);
    if (!patch.name) throw new Error('请填写 IP 名称');
    const at = nowIso();
    const profile: IpProfile = {
        id: createId('ip'),
        name: patch.name,
        positioning: '',
        audience: '',
        topics: '',
        expression: '',
        visual: '',
        voice: '', ...patch,
        revision: 1,
        archived: false,
        createdAt: at,
        updatedAt: at
    };
    await db.ipProfiles.add(profile);
    return profile;
}

export async function updateIpProfile(id: string, input: Partial<IpProfileInput>, expectedRevision: number, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    const patch = textPatch(input);
    await db.transaction('rw', [db.ipProfiles].flat(), async (db) => {
        const profile = await db.ipProfiles.get(id);
        if (!profile) throw new Error('IP 不存在');
        if (profile.revision !== expectedRevision) throw new Error('IP 档案已更新，请重新加载后再保存');
        if (profile.archived) throw new Error('请先恢复已归档的 IP');
        await db.ipProfiles.put({...profile, ...patch, revision: profile.revision + 1, updatedAt: nowIso()});
    });
}

export async function setIpArchived(id: string, archived: boolean, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction('rw', [db.ipProfiles].flat(), async (db) => {
        const profile = await db.ipProfiles.get(id);
        if (!profile) throw new Error('IP 不存在');
        if (profile.archived === archived) return;
        await db.ipProfiles.put({...profile, archived, revision: profile.revision + 1, updatedAt: nowIso()});
    });
}

export async function bindProjectIp(projectId: string, ipId: string | null, store?: ProductStore): Promise<void> {
    const db = store ?? productDb;
    await db.transaction('rw', [db.projects, db.ipProfiles, db.projectIpLinks], async (db) => {
        const project = await db.projects.get(projectId);
        if (!project || project.archivedAt) throw new Error('项目不存在或已归档');
        if (ipId === null) {
            await db.projectIpLinks.delete(projectId);
            return;
        }
        const profile = await db.ipProfiles.get(ipId);
        const existing = await db.projectIpLinks.get(projectId);
        if (!profile || (profile.archived && existing?.ipId !== ipId)) throw new Error('请选择未归档的 IP');
        await db.projectIpLinks.put({projectId, ipId, updatedAt: nowIso()});
    });
}
