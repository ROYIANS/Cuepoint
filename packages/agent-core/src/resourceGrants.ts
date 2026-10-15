import type {ToolBindingIdentity} from './tools.js';

/** References are evidence for a host check, never authority by possession. */
export interface ResourceGrantRef {readonly id: string; readonly revision: number}
export interface ResourceGrantSubject {readonly runId: string; readonly callId: string; readonly scopeId: string}
export interface ResourceGrantSnapshot<Fact> {
    readonly version: 1;
    readonly subject: ResourceGrantSubject;
    readonly binding: ToolBindingIdentity;
    readonly facts: readonly Fact[];
    readonly grants: readonly ResourceGrantRef[];
}
export interface ResourceGrantRequest<Fact> {
    readonly subject: ResourceGrantSubject;
    readonly binding: ToolBindingIdentity;
    readonly facts: readonly Fact[];
    readonly signal: AbortSignal;
}
/** Prepare resolves host-issued authority; the actual effect owner must recheck it atomically. */
export interface ResourceGrantPort<Fact> {
    prepare(request: ResourceGrantRequest<Fact>): Promise<ResourceGrantSnapshot<Fact>>;
    assertCurrent(expected: ResourceGrantSnapshot<Fact>, signal: AbortSignal): Promise<void>;
}
