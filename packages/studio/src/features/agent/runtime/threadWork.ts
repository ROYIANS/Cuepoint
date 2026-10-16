import type {ProductStore} from "../../../platform/storage/types";

/** Finite live owners, never reconstructed from stored run/batch IDs. */
export type AgentWorkIdentity =
    | {kind: "model"; threadId: string; invocationId: string}
    | {kind: "videoBatch"; threadId: string; batchId: string}
    | {kind: "audioBatch"; threadId: string; batchId: string; projectId: string}
    | {kind: "taskWrapup"; threadId: string; taskId: string};
export interface AgentThreadWork {
    readonly identity: Readonly<AgentWorkIdentity>;
    readonly controller: AbortController;
    readonly done: Promise<void>;
}
interface Owners {current: Map<string, AgentThreadWork>; listeners: Set<() => void>; closed: boolean}
const stores = new WeakMap<ProductStore, Owners>();
function owners(store: ProductStore) {
    let value = stores.get(store);
    if (!value) {value = {current: new Map(), listeners: new Set(), closed: false}; stores.set(store, value);}
    return value;
}
function publish(owner: Owners) {
    for (const listener of [...owner.listeners]) {try {listener();} catch { /* Optional views cannot own execution. */ }}
}
export function currentAgentThreadWork(store: ProductStore, threadId: string) {return owners(store).current.get(threadId);}
export function subscribeAgentThreadWork(store: ProductStore, listener: () => void) {
    const owner = owners(store); owner.listeners.add(listener); return () => {owner.listeners.delete(listener);};
}
/** Reserve synchronously; runtime keeps its existing Web Lock and original completion. */
export function reserveAgentThreadWork(store: ProductStore, identity: AgentWorkIdentity, controller: AbortController) {
    const owner = owners(store);
    if (owner.closed) throw new Error("应用正在退出，暂时无法开始执行");
    if (owner.current.has(identity.threadId)) throw new Error("当前对话尚有执行未结束，请等待完成或先停止");
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const work: AgentThreadWork = Object.freeze({identity: Object.freeze({...identity}), controller,
        done: new Promise<void>((yes, no) => {resolve = yes; reject = no;})});
    void work.done.catch(() => undefined);
    owner.current.set(identity.threadId, work);
    const stopped = () => publish(owner);
    controller.signal.addEventListener("abort", stopped, {once: true});
    let bound = false;
    return {
        work,
        /** Bind before notifying. Stop can then run synchronously from a subscriber. */
        follow(original: Promise<void>) {
            if (bound) throw new Error("执行完成句柄已绑定");
            bound = true;
            const cleanup = () => {
                if (owner.current.get(identity.threadId) === work) owner.current.delete(identity.threadId);
                controller.signal.removeEventListener("abort", stopped);
                publish(owner);
            };
            void original.then(() => {cleanup(); resolve();}, cause => {cleanup(); reject(cause);});
            publish(owner);
        }
    };
}
/** Close new work, signal every captured owner, then wait original flush/settlement. */
export async function shutdownAgentThreadWork(store: ProductStore) {
    const owner = owners(store); owner.closed = true;
    const work = [...owner.current.values()];
    for (const entry of work) entry.controller.abort();
    await Promise.allSettled(work.map(entry => entry.done));
}
