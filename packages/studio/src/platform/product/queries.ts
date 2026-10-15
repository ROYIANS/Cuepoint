import {type DependencyList, useEffect, useRef, useState} from "react";
import {db} from "./store";
import type {StoreTx} from "../storage/types";

/** Adapter observation retains the last successful result while dependencies reload.
 * The query receives its explicit readonly snapshot, including nested helper reads. */
export function useProductQueryState<T>(query: (tx: StoreTx) => Promise<T> | T, dependencies: DependencyList = [], defaultResult?: T): {
    value: T | undefined;
    error: Error | null
} {
    const queryRef = useRef(query);
    const dependencyRef = useRef<{ values: DependencyList; token: object }>({values: dependencies, token: {}});
    if (dependencies.length !== dependencyRef.current.values.length || dependencies.some((value, index) => !Object.is(value, dependencyRef.current.values[index]))) {
        dependencyRef.current = {values: dependencies, token: {}};
    }
    const dependencyToken = dependencyRef.current.token;
    const [state, setState] = useState<{ value: T | undefined; error: Error | null }>({
        value: defaultResult,
        error: null
    });
    useEffect(() => {
        queryRef.current = query;
    });
    useEffect(() => {
        let active = true;
        const stop = db.observe(tx => queryRef.current(tx), {
            next: value => {
                if (active) setState({value, error: null});
            },
            error: cause => {
                if (active) setState(previous => ({
                    ...previous,
                    error: cause instanceof Error ? cause : new Error("读取数据失败", {cause})
                }));
            },
        });
        return () => {
            active = false;
            stop();
        };
    }, [dependencyToken]);
    return state;
}

export function useProductQuery<T>(query: (tx: StoreTx) => Promise<T> | T, dependencies: DependencyList = [], defaultResult?: T): T | undefined {
    const state = useProductQueryState(query, dependencies, defaultResult);
    if (state.error !== null) throw state.error;
    return state.value;
}
