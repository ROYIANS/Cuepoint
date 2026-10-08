import {useCallback, useEffect, useRef, useState} from "react";

export function useChatExecutionSession(threadId?: string) {
    const [sending, setSending] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const executionThreadRef = useRef<string | undefined>(undefined);
    const sendLockRef = useRef(false);
    const epoch = useRef(0);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        // Effect replay can abort an in-flight request; its final flush still owns the lock.
        setSending(sendLockRef.current);
        return () => {mounted.current = false; abortRef.current?.abort();};
    }, []);
    useEffect(() => {
        if (executionThreadRef.current !== threadId) abortRef.current?.abort();
    }, [threadId]);
    const acquire = useCallback(() => {
        if (!mounted.current || sendLockRef.current) return undefined;
        const controller = new AbortController();
        const token = {controller, epoch: ++epoch.current};
        sendLockRef.current = true;
        abortRef.current = controller;
        executionThreadRef.current = threadId;
        setSending(true);
        return token;
    }, [threadId]);
    const release = useCallback((token: {controller: AbortController; epoch: number}) => {
        if (epoch.current !== token.epoch || abortRef.current !== token.controller) return;
        sendLockRef.current = false;
        abortRef.current = null;
        if (mounted.current) setSending(false);
    }, []);
    return {sending, abortRef, executionThreadRef, sendLockRef, acquire, release};
}
