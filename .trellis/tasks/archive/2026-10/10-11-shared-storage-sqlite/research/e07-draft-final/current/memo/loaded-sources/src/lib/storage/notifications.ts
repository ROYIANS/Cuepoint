/** A consumer callback cannot change a committed storage outcome or stop its peers. */
export function deliverStorageNotification<T>(listener:(value:T)=>void,value:T):void {
    try {listener(value);} catch {
        // Notification consumers own their failures; storage has already committed.
    }
}
