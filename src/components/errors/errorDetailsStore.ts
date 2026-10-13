let opened = false;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of [...listeners]) listener();
}

/** Minimal subscribable open state; the details dialog subscribes in a later step. */
export function subscribeErrorDetails(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function getErrorDetailsOpen(): boolean {
    return opened;
}

export function openErrorDetails(): void {
    opened = true;
    emit();
}

export function closeErrorDetails(): void {
    opened = false;
    emit();
}
