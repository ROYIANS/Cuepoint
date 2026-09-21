# Shared implementation contract

Data worker owns types in src/domain/materials.ts and repositories; notify others before deviations.

## IP
`IpProfile`: id,name,positioning,audience,topics,expression,visual,voice (all strings), revision:number, archived:boolean, createdAt,updatedAt.
`IpProfileInput`: Pick profile text fields; name required others optional accepted creation.
`ProjectIpLink`: projectId (primary), ipId, updatedAt.
Tables: db.ipProfiles, db.projectIpLinks.
Functions db/ipProfiles.ts:
- createIpProfile(input): Promise<IpProfile>
- updateIpProfile(id,input,expectedRevision): Promise<void> (partial text patch, CAS)
- setIpArchived(id,archived): Promise<void>
- bindProjectIp(projectId,ipId:string|null): Promise<void> (validate both; archived IP no new binding; null detaches)
IP archival preserves bound projects/materials, no hard IP delete in first increment.

## Materials
`MaterialScope = {kind:'global'} | {kind:'ip';id:string} | {kind:'project';id:string}`.
`MaterialKind = 'image'|'video'|'audio'|'document'|'character'|'scene'|'prop'|'style'`.
`LibraryMaterial`: id,name,kind,scope,revision,archived,notes,tags:string[],createdAt,updatedAt, source?:{projectId?:string;entityId?:string;materialId?:string;revision?:number}.
`MaterialPayload`: discriminated `{type:'file';blob:Blob;filename:string;mimeType:string}` OR `{type:'setting';kind:'character'|'scene'|'prop'|'style';entity: Character|Scene|Prop|VisualStyle;media:MediaRecord[]}`.
`MaterialVersion`: id,materialId,revision,payload,createdAt.
`MaterialUse`: id,materialId,revision,projectId,targetKind:'media'|'character'|'scene'|'prop'|'style',targetId,mediaIds:string[],createdAt,updatedAt,targetFingerprint?:string. Explicit update preserves history (new media use or record prior targets) so older references still count. No automatic old content rewrite.
`MaterialEvent`: id,materialId,action,createdAt, detail:string.
Tables db.libraryMaterials, db.materialVersions, db.materialUses, db.materialEvents.

Functions db/materials.ts:
- createFileMaterial(file:File,scope,name?:string): Promise<LibraryMaterial> infer kind safely supports image/video/audio/plaintext/PDF/DOCX; reject unsupported/empty and unsafe active formats. No arbitrary HTML/SVG embedding.
- promoteLegacyMaterial(kind:MaterialKind|'media',entityId:string,scope:MaterialScope): Promise<LibraryMaterial> source includes current owner; independent Blob snapshots; validates owner/file/slot references; for media infer kind. Supports studio-owned records as source as well as project.
- promoteMaterial(id,scope): Promise<LibraryMaterial> independent copy at latest revision, source provenance.
- addFileMaterialVersion(id,file:File,expectedRevision:number): Promise<void> same media kind only; CAS
- refreshSettingMaterial(id,expectedRevision:number): Promise<void> snapshot original legacy entity as new version; reject missing source/archived. UI explains source editing, then snapshot refresh.
- updateMaterialMetadata(id,{name?,notes?,tags?},expectedRevision:number): Promise<void> revision conflict protection, data worker clarify metadata revisions/payload versions.
- setMaterialArchived(id,archived): Promise<void>
- deleteMaterial(id): Promise<void> guarded no uses AND no material provenance refs; remove all versions, log tombstone event retained.
- useMaterialInProject(id,projectId): Promise<MaterialUse> active scope/target valid, newest immutable snapshot, project-owned clones; repeat at same revision idempotent.
- updateMaterialUse(useId): Promise<MaterialUse> explicit latest adoption, immutable media behavior; structured changes guarded by target fingerprint, validate scope. History retention.
- listMaterialUsage(id): Promise<MaterialUse[]> includes existing bindings.
UI can useLiveQuery table reads, repository handles durable writes.

## Primary integration
- Add db.materialUses to PRODUCTION_TABLES and collectMediaIds; retained uses protect adopted media even before slot use. All callers' transaction lists must include materialUses when calling collectMediaIds.
- Project delete transaction deletes materialUses and projectIpLinks; project-owned libraryMaterials archived (not destroyed) with snapshot retention, shared originals unaffected.
- ZIP export includes adopted retained media, no automatic live IP bindings on import. Primary verifies whether optional provenance export is needed. Legacy shape remains unchanged.
- Primary integrates ProjectIpPicker in ProjectGalleryPage; IP worker exports component props `{value:string|null;onChange:(id:string|null)=>void;disabled?:boolean}` listing active IPs + current archived value, independent option. Primary may add change binding dialog.
- Materials route `/assets` search validates optional `ip?:string`, `project?:string`, `view?:'media'|'settings'`; IP worker links using these search keys.
