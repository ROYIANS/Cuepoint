import type {ComposerProps} from "@/components/agent/composerTypes";
import type {ChatThread} from "@/domain/types";
import type {ReactNode} from "react";

// Only presentation is simplified. The real AgentChatPage owns all callbacks,
// draft state, Dexie subscriptions, execution ownership and router navigation.
export function Surface({composer, threads, onSelectThread, onNewTopic}: {
    composer: ComposerProps; threads: ChatThread[]; onSelectThread: (id: string) => void; onNewTopic?: () => void
}) {
    return <main data-owner={composer.threadId ?? "home"}>
        <textarea aria-label="draft" value={composer.value} onChange={event => composer.onChange(event.target.value)}/>
        <button onClick={composer.onSend} disabled={composer.sending}>Send</button>
        <button onClick={composer.onStop}>Stop</button>
        <button onClick={() => composer.onAttachReference?.({referenceId: window.b07.referenceId, revision: 1})}>Attach</button>
        <button onClick={() => composer.onProjectChange(window.b07.projectId)}>Project</button>
        <button onClick={() => composer.onModelChange("model")}>Model</button>
        {onNewTopic && <button onClick={onNewTopic}>New topic</button>}
        <output data-testid="references">{composer.attachments?.map(item => item.referenceId).join(",")}</output>
        <output data-testid="sending">{String(composer.sending)}</output>
        <nav>{threads.map(thread => <button key={thread.id} data-thread={thread.id} onClick={() => onSelectThread(thread.id)}>{thread.title}</button>)}</nav>
    </main>;
}
export function Leaf() {return null;}
export function Flexbox({children}: {children?: ReactNode}) {return <div>{children}</div>;}
export const Button = "button";
export const Empty = Leaf;
