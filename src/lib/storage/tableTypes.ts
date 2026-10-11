import type {
    AudioChapter,
    AudioClip,
    AudioExport,
    AudioSegment,
    AudioSpeaker,
    AudioTake,
    AudioTrack
} from "@/domain/audio";
import type {MusicDraft, MusicWork} from "@/domain/music";
import type {AudioGenerationJob} from "@/domain/audioGeneration";
import type {AudioGenerationBatch, AudioGenerationBatchItem} from "@/domain/audioGenerationBatch";
import type {AudioArrangementProposal} from "@/domain/audioArrangement";
import type {
    IpProfile,
    LibraryMaterial,
    MaterialEvent,
    MaterialUse,
    MaterialVersion,
    ProjectIpLink
} from "@/domain/materials";
import type {SearchConnection} from "@/domain/search";
import type {GenerationBatch, GenerationBatchItem} from "@/domain/agentGenerationBatch";
import type {ProjectReference, ReferenceChunk} from "@/domain/references";
import type {ProjectMemory, ProjectMemoryVersion} from "@/domain/projectMemory";
import type {AgentTaskWrapup, AgentTaskWrapupVersion} from "@/domain/agentTaskWrapup";
import type {AgentTaskRecord, AgentTaskRecordVersion} from "@/domain/agentTaskRecords";
import type {AgentGenerationJob} from "@/domain/agentGeneration";
import type {ContextCompaction} from "@/domain/context";
import type {AgentConfig, AgentRun, AgentTask, AgentToolCall} from "@/domain/agent";
import type {ProductionProposal} from "@/domain/production";
import type {
    Character,
    ChatMessage,
    ChatThread,
    ConnectorConfig,
    Episode,
    MediaRecord,
    Project,
    Prop,
    Scene,
    Shot,
    VisualStyle,
} from "@/domain/types";

export interface ProductRows {
    audioChapters: AudioChapter;
    audioSpeakers: AudioSpeaker;
    audioSegments: AudioSegment;
    audioTakes: AudioTake;
    audioTracks: AudioTrack;
    audioClips: AudioClip;
    audioExports: AudioExport;
    musicDrafts: MusicDraft;
    musicWorks: MusicWork;
    audioGenerationJobs: AudioGenerationJob;
    audioGenerationBatches: AudioGenerationBatch;
    audioGenerationBatchItems: AudioGenerationBatchItem;
    audioArrangementProposals: AudioArrangementProposal;
    ipProfiles: IpProfile;
    projectIpLinks: ProjectIpLink;
    libraryMaterials: LibraryMaterial;
    materialVersions: MaterialVersion;
    materialUses: MaterialUse;
    materialEvents: MaterialEvent;
    searchConnections: SearchConnection;
    projectReferences: ProjectReference;
    referenceChunks: ReferenceChunk;
    projectMemories: ProjectMemory;
    projectMemoryVersions: ProjectMemoryVersion;
    agentTaskWrapups: AgentTaskWrapup;
    agentTaskWrapupVersions: AgentTaskWrapupVersion;
    agentGenerationBatches: GenerationBatch;
    agentGenerationBatchItems: GenerationBatchItem;
    agentGenerationJobs: AgentGenerationJob;
    contextCompactions: ContextCompaction;
    agentTasks: AgentTask;
    agentToolCalls: AgentToolCall;
    agents: AgentConfig;
    agentRuns: AgentRun;
    productionProposals: ProductionProposal;
    projects: Project;
    characters: Character;
    scenes: Scene;
    props: Prop;
    styles: VisualStyle;
    episodes: Episode;
    shots: Shot;
    media: MediaRecord;
    connectors: ConnectorConfig;
    connectorAliases: ConnectorConfig;
    agentTaskRecords: AgentTaskRecord;
    agentTaskRecordVersions: AgentTaskRecordVersion;
    chatThreads: ChatThread;
    chatMessages: ChatMessage;
}

export type TableName = keyof ProductRows;
