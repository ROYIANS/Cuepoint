import {afterEach, describe, expect, it, vi} from "vitest";
import {createProductRouterHistory} from "@/lib/productRouterHistory";
import {createHistoryNavigation} from "@/lib/historyNavigation";

/** Executable same-document stack: installed browser/hash history owns POP/blockers. */
function browser(href: string) {
    const events = new Map<string, Set<() => void>>();
    const entries: Array<{url: URL; state: unknown}> = [{url: new URL(href),state: null}];
    let index = 0;
    function pop(delta: number) {
        const next = Math.max(0,Math.min(entries.length - 1,index + delta));
        if (next === index) return;
        index = next; queueMicrotask(() => events.get("popstate")?.forEach(listener => listener()));
    }
    const history = {
        get state() {return entries[index].state;}, get length() {return entries.length;},
        pushState(state: unknown,_title: string,url?: string | URL | null) {
            entries.splice(index + 1); entries.push({state,url: new URL(url ?? entries[index].url,entries[index].url)}); index++;
        },
        replaceState(state: unknown,_title: string,url?: string | URL | null) {entries[index] = {state,url: new URL(url ?? entries[index].url,entries[index].url)};},
        back: () => pop(-1),forward: () => pop(1),go: pop,
    };
    const win = {get location() {return entries[index].url;},history,document:{baseURI:href},
        ...(href.startsWith("tauri:") ? {__TAURI_INTERNALS__:{invoke:vi.fn()}} : {}),
        addEventListener(type: string,fn: () => void) {if (!events.has(type)) events.set(type,new Set()); events.get(type)!.add(fn);},
        removeEventListener(type: string,fn: () => void) {events.get(type)?.delete(fn);},
    };
    vi.stubGlobal("window",win); vi.stubGlobal("document",win.document);
    return win;
}
async function settle() {for (let i = 0; i < 8; i++) await Promise.resolve();}
afterEach(() => vi.unstubAllGlobals());

describe.each(["browser","hash"])("known %s navigation",mode => {
    function setup() {
        const win = browser(mode === "hash" ? "tauri://localhost/index.html" : "http://localhost/");
        const history = createProductRouterHistory();
        const store = createHistoryNavigation(history);
        return {win,history,store};
    }
    it("starts conservatively, traverses real POP and truncates a forward branch",async () => {
        const {history,store} = setup();
        expect(store.getSnapshot()).toEqual({canBack:false,canForward:false,pending:false});
        history.push("/projects"); await settle(); history.push("/p/a/story"); await settle();
        store.back(); expect(store.getSnapshot().pending).toBe(true); store.back(); await settle();
        expect(history.location.pathname).toBe("/projects");
        expect(store.getSnapshot()).toEqual({canBack:true,canForward:true,pending:false});
        store.forward(); await settle(); expect(history.location.pathname).toBe("/p/a/story");
        store.back(); await settle(); history.push("/assets"); await settle();
        expect(store.getSnapshot().canForward).toBe(false); store.back(); await settle();
        expect(history.location.pathname).toBe("/projects"); store.destroy(); history.destroy();
    });
    it("commits rapid PUSH boundaries and keeps REPLACE on the same physical entry",async () => {
        const {win,history,store} = setup();
        history.push("/discarded"); history.push("/final"); history.replace("/final?view=settings"); await settle();
        expect(win.history.length).toBe(3); store.back(); await settle();
        expect(history.location.pathname).toBe("/discarded"); expect(store.getSnapshot().canBack).toBe(true);
        store.back(); await settle(); expect(history.location.pathname).toBe("/");
        store.forward(); await settle(); store.forward(); await settle(); expect(history.location.search).toBe("?view=settings");
        history.replace("/new-title"); await settle(); store.back(); await settle();
        expect(history.location.pathname).toBe("/discarded"); store.destroy(); history.destroy();
    });
    it("waits for a real blocker and preserves both entry and branch on Continue",async () => {
        const {history,store} = setup();
        history.push("/projects"); await settle(); history.push("/assets"); await settle();
        let resolve: (blocked: boolean) => void = () => {};
        const blocker = vi.fn(() => new Promise<boolean>(done => {resolve = done;}));
        const unblock = history.block({blockerFn:blocker});
        store.back(); await settle(); expect(store.getSnapshot().pending).toBe(true);
        resolve(true); await settle(); expect(history.location.pathname).toBe("/assets");
        expect(store.getSnapshot()).toEqual({canBack:true,canForward:false,pending:false});
        store.back(); await settle(); resolve(false); await settle();
        expect(history.location.pathname).toBe("/projects"); expect(store.getSnapshot().canForward).toBe(true);
        unblock(); store.forward(); await settle(); expect(history.location.pathname).toBe("/assets");
        store.destroy(); history.destroy();
    });
    it("resets on reload and unknown accepted POP rather than trusting history length",async () => {
        const {win,history,store} = setup();
        history.push("/projects"); await settle(); history.push("/assets"); await settle();
        store.destroy(); const reload = createHistoryNavigation(history);
        expect(reload.getSnapshot().canBack).toBe(false); history.back(); await settle();
        expect(reload.getSnapshot()).toEqual({canBack:false,canForward:false,pending:false});
        expect(win.history.length).toBe(3); reload.destroy(); history.destroy();
    });
    it("does not promote an unmarked raw history destination to a known branch",async () => {
        const {win,history,store} = setup();
        history.push("/projects"); await settle();
        win.history.pushState(null,"",mode === "hash" ? "#/unknown" : "/unknown"); await settle();
        expect(store.getSnapshot()).toEqual({canBack:false,canForward:false,pending:false});
        history.back(); await settle(); expect(store.getSnapshot().canForward).toBe(false);
        store.destroy(); history.destroy();
    });

    it("keeps explicit flush boundaries between writes in the same turn",async () => {
        const {win,history,store} = setup();
        history.push("/projects"); history.flush(); history.push("/assets"); await settle();
        expect(win.history.length).toBe(3); store.back(); await settle();
        expect(history.location.pathname).toBe("/projects"); expect(store.getSnapshot().canBack).toBe(true);
        store.back(); await settle(); expect(history.location.pathname).toBe("/");
        store.destroy(); history.destroy();
    });

    it("rolls back canceled POP after coalesced pushes without physical/logical divergence",async () => {
        const {win,history,store} = setup();
        history.push("/discarded"); history.push("/final"); await settle();
        history.push("/later"); await settle(); store.back(); await settle();
        store.back(); await settle(); expect(history.location.pathname).toBe("/discarded");
        store.forward(); await settle();
        const unblock = history.block({blockerFn:()=>true});
        store.back(); await settle();
        expect(history.location.pathname).toBe("/final");
        expect(mode === "hash" ? win.location.hash : win.location.pathname).toBe(mode === "hash" ? "#/final" : "/final");
        expect(store.getSnapshot().canForward).toBe(true);
        unblock(); store.forward(); await settle(); expect(history.location.pathname).toBe("/later");
        store.destroy(); history.destroy();
    });

    it("denied async writes add no phantom entry after flushing a previous accepted write",async () => {
        const {win,history,store} = setup();
        history.push("/projects");
        const remove = history.block({blockerFn: async () => true});
        history.push("/denied"); await settle();
        expect(win.history.length).toBe(2); expect(history.location.pathname).toBe("/projects");
        expect(store.getSnapshot().canBack).toBe(true); remove(); store.back(); await settle();
        expect(history.location.pathname).toBe("/"); store.destroy(); history.destroy();
    });

    it("serializes concurrent async-accepted pushes before assigning the next index",async () => {
        const {win,history,store} = setup();
        const accept = history.block({blockerFn: async () => false});
        history.push("/discarded"); history.push("/final"); await settle();
        history.push("/later"); await settle(); accept();
        expect(win.history.length).toBe(4); store.back(); await settle();
        const reject = history.block({blockerFn:async()=>true}); store.back(); await settle();
        expect(history.location.pathname).toBe("/final");
        expect(mode === "hash" ? win.location.hash : win.location.pathname).toBe(mode === "hash" ? "#/final" : "/final");
        expect(store.getSnapshot().canForward).toBe(true); reject(); store.forward(); await settle();
        expect(history.location.pathname).toBe("/later"); store.destroy(); history.destroy();
    });

    it("advances a queued write after denial without exposing a phantom predecessor",async () => {
        const {win,history,store} = setup();
        const remove = history.block({blockerFn:async args=>args.nextLocation.pathname === "/denied"});
        history.push("/denied"); history.push("/accepted"); await settle();
        expect(win.history.length).toBe(2); expect(history.location.pathname).toBe("/accepted");
        expect(mode === "hash" ? win.location.hash : win.location.pathname).toBe(mode === "hash" ? "#/accepted" : "/accepted");
        remove(); store.back(); await settle(); expect(history.location.pathname).toBe("/");
        store.destroy(); history.destroy();
    });

});
