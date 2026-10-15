import {describe,expect,it,vi} from "vitest";
import {createNativeProbe} from "./helpers/nativeProductProbe";
import type {StoreTx} from "@/platform/storage/types";

describe("native root operation admission",()=> {
    it("bounds repeated grids of seventy simultaneous material-version snapshots below the native context ceiling",async ()=> {
        const live=new Set<string>();let peak=0,begins=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {
            const envelope=args.request as {type:string;request:{handle?:string}};
            try {
                const result=await next();
                if (envelope.type === "begin") {begins++;live.add((result as {handle:string}).handle);peak=Math.max(peak,live.size);}
                return result;
            }finally {
                if (["validate","abort","commit"].includes(envelope.type)) live.delete(envelope.request.handle!);
            }
        }});
        try {
            await native.store.transaction("rw",["materialVersions"],async tx=> {
                for (let index=0;index<70;index++) await tx.materialVersions.add({id:`v-${index}`,materialId:`m-${index}`,revision:1,payload:{type:"file",blob:new Blob([`owned ${index}`],{type:"text/plain"}),filename:`material-${index}.txt`,mimeType:"text/plain"},createdAt:"2026-10-12T00:00:00.000Z"});
            });
            begins=0;peak=0;
            for (let mount=0;mount<3;mount++) {
                const outcomes=await Promise.allSettled(Array.from({length:70},(_,index)=>native.store.materialVersions.where("[materialId+revision]").equals([`m-${index}`,1]).first()));
                expect(outcomes.filter(outcome=>outcome.status === "rejected")).toEqual([]);
                expect(outcomes.map(outcome=>outcome.status === "fulfilled" ? outcome.value?.id : null)).toEqual(Array.from({length:70},(_,index)=>`v-${index}`));
                expect(live.size).toBe(0);
            }
            expect(begins).toBe(210);
            expect(peak).toBeGreaterThan(1);
            expect(peak).toBeLessThan(64);
        }finally {await native.close();}
    },30000);
    it("retires disposed queued grid observations without beginning native contexts or invoking their callbacks",async ()=> {
        let beginCount=0;
        const native=await createNativeProbe({intercept:async (_command,args,next)=> {if ((args.request as {type:string}).type === "begin") beginCount++;return next();}});
        let release!:()=>void,started!:()=>void;
        const barrier=new Promise<void>(resolve=>release=resolve),signal=new Promise<void>(resolve=>started=resolve);
        const stops:Array<()=>void>=[];
        try {
            const write=native.store.transaction("rw",["projects"],async tx=> {started();await tx.waitFor(barrier);});
            await signal;
            const query=vi.fn(async (tx:StoreTx)=>tx.projects.count()),next=vi.fn(),error=vi.fn();
            for (let index=0;index<70;index++) stops.push(native.store.observe(query,{next,error}));
            for (const stop of stops) stop();
            release();await write;
            expect(await native.store.projects.count()).toBe(0);
            expect(query).not.toHaveBeenCalled();expect(next).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
            expect(beginCount).toBe(2);
        }finally {release?.();for (const stop of stops) stop();await native.close();}
    });
    it("finishes an over-capacity reader batch before its writer and releases a failed snapshot without callback replay",async ()=> {
        const native=await createNativeProbe();let release!:()=>void,started!:()=>void;
        const barrier=new Promise<void>(resolve=>release=resolve),signal=new Promise<void>(resolve=>started=resolve);
        try {
            const order:string[]=[],calls=Array<number>(70).fill(0);
            const reads=Array.from({length:70},(_,index)=>native.store.transaction("r",["projects"],async tx=> {
                calls[index]++;order.push(`r${index}`);started();
                const count=await tx.projects.count();await tx.waitFor(barrier);
                if (index === 17) throw new Error("failed grid snapshot");
                return count;
            }));
            await signal;
            const writer=native.store.transaction("rw",["projects"],async tx=> {order.push("writer");await tx.projects.add({id:"after-grid"} as never);});
            const last=native.store.transaction("r",["projects"],async tx=> {order.push("last-reader");return tx.projects.count();});
            release();
            const outcomes=await Promise.allSettled(reads);
            expect(outcomes.filter(outcome=>outcome.status === "rejected")).toEqual([{status:"rejected",reason:new Error("failed grid snapshot")}]);
            expect(outcomes.filter(outcome=>outcome.status === "fulfilled").map(outcome=>outcome.value)).toEqual(Array(69).fill(0));
            await writer;expect(await last).toBe(1);
            expect(calls).toEqual(Array(70).fill(1));
            expect(order).toEqual([...Array.from({length:70},(_,index)=>`r${index}`),"writer","last-reader"]);
        }finally {release?.();await native.close();}
    });
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
