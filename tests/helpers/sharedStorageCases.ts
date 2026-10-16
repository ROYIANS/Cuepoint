import {afterEach,beforeEach,describe,expect,it} from "vitest";
import {PRODUCT_SCHEMA,TABLE_NAMES} from "@/platform/storage/schema";
import schema from "@/platform/storage/schema.json";
import type {ProductStore,StoreTx} from "@/platform/storage/types";
import {executeAtomicTool} from "@/features/agent/commands/agentTools";
import {createProject} from "@/features/projects/commands/projects";

export function registerSharedStorageCases(owner:string, create:()=>Promise<{store:ProductStore;close:()=>Promise<void>}>) {
    describe(`shared storage conformance/${owner}`,()=> {
        let store:ProductStore, cleanup:()=>Promise<void>;
        beforeEach(async ()=> {const fixture=await create();store=fixture.store;cleanup=fixture.close;});
        afterEach(async ()=> {await cleanup?.();});

    it("covers every current table with exact native registry parity",()=> {
        expect(TABLE_NAMES).toHaveLength(Object.keys(schema.tables).length);
        expect(TABLE_NAMES).toContain("deviceSettings");
        expect(schema.tables).toEqual(PRODUCT_SCHEMA);
        expect(PRODUCT_SCHEMA.projectIpLinks.keyPath).toBe("projectId");
        expect(PRODUCT_SCHEMA.projectMemoryVersions.keyPath).toBe("versionId");
    });
    it.each(TABLE_NAMES)("roundtrips %s under its actual primary key",async name=> {
        const definition=PRODUCT_SCHEMA[name],row={[definition.keyPath]:"actual-key",extra:{cleared:undefined,nested:["retained",null]}};
        const table=store.table(name);
        await table.add(row as never);
        expect(await table.get("actual-key")).toEqual(row);
        expect(await table.bulkGet(["absent","actual-key","actual-key"])).toEqual([undefined,row,row]);
    });
    it("preserves compound optional unique indexes and rejects collisions atomically",async ()=> {
        await store.transaction("rw",["agentToolCalls"],async tx=> {
            await tx.agentToolCalls.add({id:"a",runId:"r",providerCallId:"same"} as never);
            await tx.agentToolCalls.add({id:"b",runId:"other",providerCallId:"same"} as never);
            await tx.agentToolCalls.add({id:"c"} as never);
            await tx.agentToolCalls.add({id:"d"} as never);
        });
        await expect(store.agentToolCalls.add({id:"e",runId:"r",providerCallId:"same"} as never)).rejects.toMatchObject({code:"constraint"});
        expect((await store.agentToolCalls.where("[runId+providerCallId]").equals(["r","same"]).toArray()).map(row=>row.id)).toEqual(["a"]);
        expect(await store.agentToolCalls.count()).toBe(4);
    });
    it("joins nested explicit scopes, queries staged rows, and rolls back late failure",async ()=> {
        await expect(store.transaction("rw",["projects","episodes"],async tx=> {
            await tx.projects.add({id:"p",name:"first"} as never);
            await tx.transaction("rw",["episodes"],async inner=> {
                expect(inner.transactionId).toBe(tx.transactionId);
                await inner.episodes.add({id:"e",projectId:"p",order:0} as never);
                expect(await tx.episodes.where("projectId").equals("p").count()).toBe(1);
                expect(await inner.episodes.get("e")).toMatchObject({projectId:"p"});
            });
            throw new Error("late-ledger-failure");
        })).rejects.toThrow("late-ledger-failure");
        expect(await store.projects.count()).toBe(0);expect(await store.episodes.count()).toBe(0);
    });
    it("rejects widening, readonly writes and escaped closed handles",async ()=> {
        let escaped:StoreTx|undefined;
        await store.transaction("r",["projects"],async tx=> {
            escaped=tx;
            await expect(tx.projects.add({id:"p"} as never)).rejects.toMatchObject({code:"scope"});
            await expect(tx.transaction("r",["episodes"],async ()=>undefined)).rejects.toMatchObject({code:"scope"});
        });
        expect(()=>escaped!.projects.get("p")).toThrow("closed");
    });
    it("returns clones and applies supplied patch keys including explicit undefined",async ()=> {
        await store.projects.add({id:"p",name:"retained",extra:{nested:{value:"original"}},defaultStyleId:"style"} as never);
        const row=await store.projects.get("p");
        (row!.extra!.nested as {value:string}).value="unwritten";
        expect((await store.projects.get("p"))?.extra).toEqual({nested:{value:"original"}});
        await store.projects.update("p",{defaultStyleId:undefined});
        const next=await store.projects.get("p");
        expect(Object.hasOwn(next!,"defaultStyleId")).toBe(true);
        expect(next?.defaultStyleId).toBeUndefined();expect(next?.name).toBe("retained");
        expect(await store.projects.update("absent",{name:"x"})).toBe(0);
    });
    it("orders indexed ties by primary key and preserves reverse sort direction",async ()=> {
        await store.shots.bulkPut([{id:"z",projectId:"p",episodeId:"e",order:2},{id:"a",projectId:"p",episodeId:"e",order:2},{id:"m",projectId:"p",episodeId:"e",order:1}] as never[]);
        expect((await store.shots.orderBy("order").toArray()).map(row=>row.id)).toEqual(["m","a","z"]);
        expect((await store.shots.where("episodeId").equals("e").reverse().sortBy("order")).map(row=>row.id)).toEqual(["z","a","m"]);
        await store.shots.where("episodeId").equals("e").filter(row=>row.order === 2).modify({order:4});
        expect(await store.shots.orderBy("order").first()).toMatchObject({id:"m"});
        expect(await store.shots.where("episodeId").equals("e").filter(row=>row.order === 4).delete()).toBe(2);
    });
    it("does not issue commit notification after failed writes",async ()=> {
        const events:unknown[]=[];const remove=store.subscribe(event=>events.push(event));
        await expect(store.transaction("rw",["projects"],async tx=> {await tx.projects.add({id:"p"} as never);throw new Error("fail");})).rejects.toThrow();
        expect(events).toEqual([]);
        await store.projects.add({id:"p"} as never);expect(events).toHaveLength(1);remove();
    });
    it("queries every registered index with the same equality, anyOf and ordering rules",async ()=> {
        const set=(row:Record<string,unknown>,path:string,value:string)=> {
            const parts=path.split(".");let target=row;
            for (const part of parts.slice(0,-1)) {target[part] ??={};target=target[part] as Record<string,unknown>;}
            target[parts[parts.length-1]]=value;
        };
        for (const name of TABLE_NAMES) {
            const definition=PRODUCT_SCHEMA[name],table=store.table(name);
            for (const index of definition.indexes) {
                await table.clear();
                const left:Record<string,unknown>={[definition.keyPath]:"a"},right:Record<string,unknown>={[definition.keyPath]:"b"};
                for (const path of index.keyPaths) {set(left,path,"owner");set(right,path,index.unique ? "other" : "owner");}
                await table.bulkAdd([left,right] as never[]);
                const key=index.keyPaths.length === 1 ? "owner" : index.keyPaths.map(()=>"owner");
                const expected=index.unique ? ["a"] : ["a","b"];
                expect((await table.where(index.name).equals(key).toArray()).map(row=>(row as Record<string,unknown>)[definition.keyPath]),`${name}.${index.name}`).toEqual(expected);
                expect((await table.where(index.name).anyOf([key,key]).reverse().toArray()).map(row=>(row as Record<string,unknown>)[definition.keyPath])).toEqual([...expected].reverse());
            }
        }
    },30000);
    it("retains empty, NUL, long and lone UTF16 identities and indexed values",async ()=> {
        const ids=["","nul\0id","id\ud800","🌹".repeat(5000)];
        await store.transaction("rw",["shots"],async tx=> {
            for (const id of ids) await tx.shots.add({id,projectId:`owner:${id}`,episodeId:"same",order:Infinity} as never);
        });
        for (const id of ids) {
            expect(await store.shots.get(id)).toMatchObject({id,projectId:`owner:${id}`,order:Infinity});
            expect((await store.shots.where("projectId").equals(`owner:${id}`).toArray()).map(row=>row.id)).toEqual([id]);
        }
        expect((await store.shots.orderBy("order").toArray()).map(row=>row.id)).toEqual([...ids].sort());
    },30000);
    it("keeps bulk writes atomic and exposes callback changes, deletes and empty selections",async ()=> {
        await store.projects.bulkPut([{id:"a",name:"one"},{id:"b",name:"two"}] as never[]);
        await expect(store.projects.bulkAdd([{id:"c"},{id:"a"}] as never[])).rejects.toMatchObject({code:"constraint"});
        expect(await store.projects.get("c")).toBeUndefined();
        expect(await store.projects.where("id").anyOf([]).count()).toBe(0);
        const visited:string[]=[];
        await store.projects.toArray();
        await store.projects.where("id").anyOf("b","a").each(row=>visited.push(row.id));
        expect(visited).toEqual(["a","b"]);
        expect(await store.projects.filter(row=>row.id === "a").modify(row=> {row.name="changed";})).toBe(1);
        expect(await store.projects.get("a")).toMatchObject({name:"changed"});
        await store.projects.bulkDelete(["absent","a"]);expect(await store.projects.count()).toBe(1);
        await store.projects.clear();expect(await store.projects.count()).toBe(0);
    });
    it("preserves a long UTF16 object key through the actual row adapter",async ()=> {
        const key="k".repeat(180000)+"\ud800",row={id:"long-object-key",extra:{[key]:{cleared:undefined,text:"body\udc00"}}};
        await store.projects.add(row as never);
        expect(await store.projects.get(row.id)).toEqual(row);
    },30000);
    it("isolates postcommit subscribers for put, transactions and atomic tool ledgers",async ()=> {
        const observed:unknown[]=[];
        const removeBad=store.subscribe(()=> {throw new Error("consumer failed after COMMIT");});
        const removeGood=store.subscribe(change=>observed.push(change));
        try {
            await expect(store.projects.put({id:"put"} as never)).resolves.toBe("put");
            let transactions=0;
            await expect(store.transaction("rw",["projects"],async tx=> {transactions++;await tx.projects.put({id:"transaction"} as never);return "committed";})).resolves.toBe("committed");
            expect(transactions).toBe(1);expect(observed).toHaveLength(2);
            await store.transaction("rw",["chatThreads","chatMessages","agentRuns","agentToolCalls"],async tx=> {
                await tx.chatThreads.add({id:"thread"} as never);
                await tx.chatMessages.add({id:"assistant",threadId:"thread",runId:"run",role:"assistant"} as never);
                await tx.agentRuns.add({id:"run",threadId:"thread",assistantMessageId:"assistant",status:"running"} as never);
                await tx.agentToolCalls.add({id:"call",threadId:"thread",runId:"run",status:"running"} as never);
            });
            const context={threadId:"thread",runId:"run",callId:"call",signal:new AbortController().signal,store};let runs=0;
            const execute=async (tx:StoreTx)=> {runs++;return {id:(await createProject("已提交",undefined,undefined,undefined,tx)).id};};
            const result=await executeAtomicTool(context,execute);
            expect(await executeAtomicTool(context,execute)).toEqual(result);expect(runs).toBe(1);
            expect(await store.projects.count()).toBe(3);expect(await store.episodes.count()).toBe(1);
            expect(await store.agentToolCalls.get("call")).toMatchObject({status:"completed",result:JSON.stringify(result)});
            expect(observed).toHaveLength(5);
        } finally {removeBad();removeGood();}
    });
    it("keeps limit-before-sortBy and aggregate count semantics with duplicate selectors",async ()=> {
        await store.chatMessages.bulkPut([{id:"a",threadId:"t",createdAt:"3"},{id:"b",threadId:"t",createdAt:"1"},{id:"c",threadId:"t",createdAt:"2"}] as never[]);
        expect((await store.chatMessages.where("threadId").equals("t").limit(2).sortBy("createdAt")).map(row=>row.id)).toEqual(["b","a"]);
        expect(await store.chatMessages.where("threadId").anyOf(["t","t"]).limit(2).count()).toBe(2);
        expect(await store.chatMessages.where("threadId").equals("t").limit(0).count()).toBe(0);
        await store.transaction("rw",["chatMessages"],async tx=> {
            await tx.chatMessages.add({id:"d",threadId:"t",createdAt:"4"} as never);
            expect(await tx.chatMessages.where("threadId").equals("t").count()).toBe(4);
            expect((await tx.chatMessages.where("threadId").equals("t").limit(2).toArray()).map(row=>row.id)).toEqual(["a","b"]);
        });
    });
    });
}
