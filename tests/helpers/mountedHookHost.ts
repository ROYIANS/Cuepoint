/** A deterministic hook lifecycle host for production callbacks. It exercises
 * dependency cleanup and retained refs; it does not claim native DOM playback. */
export function mountedHookHost() {
    const cells: unknown[] = [];
    const effects = new Map<number, {dependencies?: readonly unknown[]; cleanup?: () => void}>();
    let cursor = 0;
    let pending: Array<() => void> = [];
    return {
        useState(initial: unknown) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
            return [cells[index], (next: unknown) => {cells[index] = typeof next === "function" ? next(cells[index]) : next;}];
        },
        useRef(initial: unknown) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = {current: initial};
            return cells[index];
        },
        useEffect(effect: () => unknown, dependencies?: readonly unknown[]) {
            const index = cursor++;
            const previous = effects.get(index);
            if (previous && dependencies && previous.dependencies && dependencies.length === previous.dependencies.length && dependencies.every((value, at) => Object.is(value, previous.dependencies![at]))) return;
            pending.push(() => {
                previous?.cleanup?.();
                const cleanup = effect();
                effects.set(index, {dependencies, cleanup: typeof cleanup === "function" ? cleanup as () => void : undefined});
            });
        },
        render<T>(run: () => T): T {cursor = 0;pending = [];const value = run();const flush = pending;pending = [];flush.forEach(effect => effect());return value;},
        unmount() {effects.forEach(effect => effect.cleanup?.());effects.clear();cells.length = 0;pending = [];},
    };
}
