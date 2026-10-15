import {afterEach, describe, expect, it, vi} from "vitest";
import type {StoreObserver,StoreTx} from "@/platform/storage/types";
type Effect={deps?:unknown[];cleanup?:()=>void};
const host=vi.hoisted(()=>({cells:[] as unknown[], cursor:0, pending:[] as Array<()=>void>}));
vi.mock("react",async original=>{
    const actual=await original<typeof import("react")>();
    return {...actual,
        useRef:(initial:unknown)=>{const i=host.cursor++;if(!(i in host.cells))host.cells[i]={current:initial};return host.cells[i];},
        useState:(initial:unknown)=>{const i=host.cursor++;if(!(i in host.cells))host.cells[i]=initial;return [host.cells[i],(value:unknown)=>{host.cells[i]=typeof value==="function" ? value(host.cells[i]):value;}];},
        useEffect:(setup:()=>void|(()=>void),deps?:unknown[])=>{
            const i=host.cursor++;const previous=host.cells[i] as Effect|undefined;
            if (!previous || !deps || deps.length!==previous.deps?.length || deps.some((value,index)=>!Object.is(value,previous.deps?.[index]))) {
                const cell:Effect={deps};host.cells[i]=cell;host.pending.push(()=>{previous?.cleanup?.();cell.cleanup=setup()||undefined;});
            }
        },
    };
});
import {db} from "@/platform/product/store";
import {useProductQuery,useProductQueryState} from "@/platform/product/queries";
function draw<T>(query:()=>T):T {host.cursor=0;const value=query();host.pending.splice(0).forEach(effect=>effect());return value;}
function cleanup(){for(const cell of host.cells){if(cell && typeof cell==="object" && "cleanup" in cell)(cell as Effect).cleanup?.();}host.cells=[];host.pending=[];}
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("shared query lifecycle used by current pages",()=>{
    it("passes explicit Tx, retains success during a scope change and ignores late old-owner replies",async()=>{
        const registrations:Array<{read:(tx:StoreTx)=>Promise<unknown>|unknown;observer:StoreObserver<unknown>;stop:ReturnType<typeof vi.fn>}>=[];
        vi.spyOn(db,"observe").mockImplementation((read,observer)=>{const stop=vi.fn();registrations.push({read,observer,stop});return stop;});
        let id="old";const query=vi.fn(async(tx:StoreTx)=>({id,value:await tx.projects.get(id)}));
        expect(draw(()=>useProductQuery(query,[id]))).toBeUndefined();
        registrations[0].observer.next({id:"old",value:"old result"});
        expect(draw(()=>useProductQuery(query,[id]))).toEqual({id:"old",value:"old result"});
        expect(registrations).toHaveLength(1);
        id="new";
        expect(draw(()=>useProductQuery(query,[id]))).toEqual({id:"old",value:"old result"});
        expect(registrations[0].stop).toHaveBeenCalledOnce();
        registrations[0].observer.next({id:"old",value:"late obsolete"});
        expect(draw(()=>useProductQuery(query,[id]))).toEqual({id:"old",value:"old result"});
        const tx={projects:{get:vi.fn(async()=>"native snapshot")}} as unknown as StoreTx;
        registrations[1].observer.next(await registrations[1].read(tx));
        expect(tx.projects.get).toHaveBeenCalledWith("new");
        expect(draw(()=>useProductQuery(query,[id]))).toEqual({id:"new",value:"native snapshot"});
        cleanup();expect(registrations[1].stop).toHaveBeenCalledOnce();
    });
    it("preserves prior data with truthful failure state and recovers on a later success",()=>{
        let observer!:StoreObserver<string>;
        const stop=vi.fn();vi.spyOn(db,"observe").mockImplementation((_read,target)=>{observer=target as StoreObserver<string>;return stop;});
        expect(draw(()=>useProductQueryState(()=>"result",[],"default"))).toEqual({value:"default",error:null});
        observer.next("saved");
        const error=new Error("SQLite read failed");observer.error(error);
        expect(draw(()=>useProductQueryState(()=>"result",[]))).toEqual({value:"saved",error});
        observer.next("recovered");expect(draw(()=>useProductQueryState(()=>"result",[]))).toEqual({value:"recovered",error:null});
        cleanup();observer.error(new Error("late"));expect(stop).toHaveBeenCalledOnce();
    });
    it("the ordinary hook propagates storage errors to the page error boundary",()=>{
        let observer!:StoreObserver<string>;
        vi.spyOn(db,"observe").mockImplementation((_read,target)=>{observer=target as StoreObserver<string>;return ()=>undefined;});
        draw(()=>useProductQuery(()=>"result",[]));
        const error=new Error("Unavailable");observer.error(error);
        expect(()=>draw(()=>useProductQuery(()=>"result",[]))).toThrow(error);
    });
});
