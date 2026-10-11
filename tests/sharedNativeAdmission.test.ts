import {describe,expect,it} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";

describe("native root operation admission",()=> {
    it("advances the FIFO after cancellation and failure without replaying a callback",async ()=> {
        const native=await createNativeProbe();let release!:()=>void,started!:()=>void;
        const barrier=new Promise<void>(resolve=>release=resolve),signal=new Promise<void>(resolve=>started=resolve);
        try {
            const order:string[]=[],controller=new AbortController();
            const first=native.store.transaction("rw",["projects"],async tx=> {order.push("first");started();await tx.waitFor(barrier);await tx.projects.add({id:"first"} as never);});
            await signal;
            const cancelled=native.store.transaction("rw",["projects"],async ()=> {order.push("cancelled");controller.signal.throwIfAborted();});
            const failed=native.store.transaction("rw",["projects"],async tx=> {order.push("failed");await tx.projects.add({id:"rolled-back"} as never);throw new Error("late failure");});
            const last=native.store.projects.add({id:"last"} as never);
            controller.abort();release();
            const outcomes=await Promise.allSettled([first,cancelled,failed,last]);
            expect(outcomes.map(outcome=>outcome.status)).toEqual(["fulfilled","rejected","rejected","fulfilled"]);
            expect(order).toEqual(["first","cancelled","failed"]);
            expect((await native.store.projects.toArray()).map(row=>row.id)).toEqual(["first","last"]);
        }finally {release?.();await native.close();}
    });
    it("admits concurrent readers, waits for their snapshots, and keeps later readers behind a queued writer",async ()=> {
        const native=await createNativeProbe();let release!:()=>void,started!:()=>void;
        const barrier=new Promise<void>(resolve=>release=resolve),signal=new Promise<void>(resolve=>started=resolve);
        try {
            const order:string[]=[];let readers=0;
            const read=(name:string)=>native.store.transaction("r",["projects"],async tx=> {order.push(name);await tx.projects.count();if (++readers === 2) started();await tx.waitFor(barrier);return tx.projects.count();});
            const first=read("r1"),second=read("r2");await signal;
            const write=native.store.transaction("rw",["projects"],async tx=> {order.push("writer");await tx.projects.add({id:"saved"} as never);});
            const last=native.store.transaction("r",["projects"],async tx=> {order.push("r3");return tx.projects.count();});
            release();expect(await Promise.all([first,second,write,last])).toEqual([0,0,undefined,1]);
            expect(order).toEqual(["r1","r2","writer","r3"]);
        }finally {release?.();await native.close();}
    });
});
