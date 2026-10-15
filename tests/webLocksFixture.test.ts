import {describe, expect, it} from 'vitest';

describe('exclusive Web Locks host fixture', () => {
    it('queues default requests while ifAvailable refuses the same live owner', async () => {
        let release!: () => void;
        const blocked = new Promise<void>(resolve => {release = resolve;});
        const order: string[] = [];
        const first = navigator.locks.request('same', async () => {order.push('first'); await blocked;});
        const second = navigator.locks.request('same', async () => {order.push('second');});
        expect(order).toEqual(['first']);
        await navigator.locks.request('same', {ifAvailable: true}, lock => {expect(lock).toBeNull();});
        expect(order).toEqual(['first']);
        release();
        await Promise.all([first, second]);
        expect(order).toEqual(['first', 'second']);
    });
});
