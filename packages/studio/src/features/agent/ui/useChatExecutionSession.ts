import {useCallback, useEffect, useRef, useState} from "react";
import {createId} from "../../../platform/identity";
import {createExecutionFeedbackController, type ExecutionFeedbackInvocation, type ExecutionFeedbackSnapshot} from "../runtime/executionFeedback";

export function useChatExecutionSession(threadId?: string) {
    const mounted = useRef(true);
    const [sending, setSending] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [feedbackSnapshot, setFeedbackSnapshot] = useState<ExecutionFeedbackSnapshot>();
    const [feedbackController] = useState(() => createExecutionFeedbackController({onChange: snapshot => {
        if (mounted.current) setFeedbackSnapshot(snapshot);
    }}));
    const feedback = useRef<ExecutionFeedbackInvocation | undefined>(undefined);
    const provisionalMessageId = useRef<string | undefined>(undefined);
    const stopRequested = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const executionThreadRef = useRef<string | undefined>(undefined);
    const sendLockRef = useRef(false);
    const epoch = useRef(0);
    useEffect(() => {
        mounted.current = true;
        // Effect replay can abort an in-flight request; its final flush still owns the lock.
        setSending(sendLockRef.current);
        setStopping(stopRequested.current && sendLockRef.current);
        return () => {
            mounted.current = false;
            abortRef.current?.abort();
            feedbackController.dispose();
        };
    }, [feedbackController]);
    useEffect(() => {
        if (executionThreadRef.current !== threadId) abortRef.current?.abort();
    }, [threadId]);
    const acquire = useCallback((userMessageId?: string) => {
        if (!mounted.current || sendLockRef.current) return undefined;
        const controller = new AbortController();
        const invocation = feedbackController.begin(createId("invocation"), threadId);
        feedback.current = invocation;
        provisionalMessageId.current = userMessageId;
        const token = {controller, epoch: ++epoch.current, feedback: invocation};
        sendLockRef.current = true;
        abortRef.current = controller;
        executionThreadRef.current = threadId;
        stopRequested.current = false;
        setSending(true);
        setStopping(false);
        return token;
    }, [threadId, feedbackController]);
    const release = useCallback((token: { controller: AbortController; epoch: number }) => {
        if (epoch.current !== token.epoch || abortRef.current !== token.controller) return;
        feedback.current?.release();
        provisionalMessageId.current = undefined;
        sendLockRef.current = false;
        abortRef.current = null;
        stopRequested.current = false;
        if (mounted.current) {
            setSending(false);
            setStopping(false);
        }
    }, []);
    const requestStop = useCallback(() => {
        if (!sendLockRef.current || !abortRef.current || stopRequested.current) return false;
        stopRequested.current = true;
        if (mounted.current) setStopping(true);
        feedback.current?.requestStop();
        abortRef.current.abort();
        return true;
    }, []);
    return {sending, stopping, requestStop, feedback: feedback.current, feedbackSnapshot,
        provisionalMessageId: provisionalMessageId.current, abortRef, executionThreadRef, sendLockRef, acquire, release};
}
