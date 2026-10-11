import {readBinaryBlob} from "@/lib/storage/binary";
import {binaryByteLength} from "@/domain/binary";
import type {ProductStore} from "@/lib/storage/types";
import {db as productDb} from '@/db/database';
import type {AgentReferenceInput} from '@/domain/referenceInput';
import type {AgentToolContext} from './tools';
import {assertMaterialVersion} from './materialContent';
import {frozenProjectScope} from './projectScope';
import {targetRevision} from '@/lib/productionRevision';
import {assertReferenceSignature} from '@/lib/references/parse';
import {parseReferenceFile} from '@/lib/references/import';
import {assertImageQueueCapacity} from './imageQueue';

async function materialBlobDigest(blob: Blob): Promise<string> {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function source(materialId: string, revision: number, context: AgentToolContext, mediaId?: string, store?: ProductStore) {
    const db = store ?? context.store ?? productDb;
    const {material, version} = await assertMaterialVersion(materialId, revision, context, db);
    const payload = version.payload;
    const file = payload.type === 'file' ? payload : payload.media.find(row => row.id === mediaId);
    if (!file || payload.type === 'file' && mediaId) throw new Error('素材文件不存在；设定素材请先读取详情，选择准确图片 ID');
    return {material, version, file};
}

export async function queueMaterialImage(materialId: string, revision: number, context: AgentToolContext, mediaId?: string, store?: ProductStore) {
    const db = store ?? context.store ?? productDb;
    await assertImageQueueCapacity(context, undefined, db);
    const {file, version} = await source(materialId, revision, context, mediaId, db);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimeType) || binaryByteLength(file.blob) <= 0 || binaryByteLength(file.blob) > 10 * 1024 * 1024) throw new Error('仅支持 10 MiB 以内的 PNG、JPEG 或 WebP 素材图片');
    const bytes = new Uint8Array(await (await readBinaryBlob(file.blob)).arrayBuffer());
    assertReferenceSignature(bytes, 'image', file.mimeType);
    await parseReferenceFile(bytes.buffer, 'image', file.mimeType, context.signal);
    const digest = await materialBlobDigest(await readBinaryBlob(file.blob));
    await source(materialId, revision, context, mediaId, db);
    const projectId = await frozenProjectScope(context, db) ?? 'studio';
    const referenceInput: AgentReferenceInput = {
        projectId, references: [],
        material: {
            kind: 'image',
            materialId,
            revision,
            readCallId: context.callId, ...(mediaId ? {mediaId} : {}),
            digest
        },
        images: [{
            projectId,
            mediaId: `material:${version.id}:${mediaId ?? 'file'}`,
            filename: file.filename,
            mimeType: file.mimeType,
            size: binaryByteLength(file.blob)
        }],
    };
    return {
        status: 'queued',
        materialId,
        revision,
        referenceInput,
        note: '已准备素材图片；下一轮向当前模型发送真实像素后才能分析。文件名和元信息不代表图片内容。'
    };
}

/** A saved read grants only this version in this run. Revalidate before and after encoding. */
export async function resolveMaterialInput(input: AgentReferenceInput, projectId: string | undefined, runId?: string, store?: ProductStore) {
    const db = store ?? productDb;
    const proof = input.material;
    if (!proof || !runId || input.discovery || input.references.length || input.coverage?.length || input.projectId !== (projectId ?? 'studio')) throw new Error('素材读取来源缺失或范围不匹配');
    const run = await db.agentRuns.get(runId), call = await db.agentToolCalls.get(proof.readCallId);
    if (!run || run.projectId !== projectId || !call || call.runId !== runId || call.threadId !== run.threadId || call.status !== 'completed' || call.name !== `material_read_${proof.kind}` || !call.result) throw new Error('素材读取记录不属于当前执行');
    const args = JSON.parse(call.arguments) as { materialId?: string; revision?: number; mediaId?: string };
    const saved = (JSON.parse(call.result) as { referenceInput?: AgentReferenceInput }).referenceInput;
    if (args.materialId !== proof.materialId || args.revision !== proof.revision || args.mediaId !== proof.mediaId || targetRevision(saved) !== targetRevision(input)) throw new Error('素材身份与读取记录不一致');
    const context: AgentToolContext = {
        projectId,
        runId,
        threadId: run.threadId,
        callId: call.id,
        signal: new AbortController().signal
    };
    const {file, version} = await source(proof.materialId, proof.revision, context, proof.mediaId, db);
    if (proof.kind === 'image') {
        const image = input.images?.[0];
        if (input.images?.length !== 1 || !image || image.projectId !== input.projectId || image.mediaId !== `material:${version.id}:${proof.mediaId ?? 'file'}` || image.mimeType !== file.mimeType || image.size !== binaryByteLength(file.blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimeType) || binaryByteLength(file.blob) > 10 * 1024 * 1024) throw new Error('素材图片身份或格式已变化');
    } else if (input.images?.length) throw new Error('文档读取不能附带图片');
    if (await materialBlobDigest(await readBinaryBlob(file.blob)) !== proof.digest) throw new Error('素材内容已变化，请重新读取');
    await source(proof.materialId, proof.revision, context, proof.mediaId, db);
    return file;
}
