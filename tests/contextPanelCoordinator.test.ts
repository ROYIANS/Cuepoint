import {beforeEach,describe,expect,it,vi} from "vitest";
import type {ReactElement} from "react";
const hooks = vi.hoisted(() => ({cells: [] as unknown[],cursor:0}));
vi.mock("react",async original => {
    const react = await original<typeof import("react")>();
    return {...react,
        useState(initial: unknown) {const i = hooks.cursor++; if (!(i in hooks.cells)) hooks.cells[i] = typeof initial === "function" ? initial() : initial; return [hooks.cells[i],(next: unknown) => {hooks.cells[i] = typeof next === "function" ? next(hooks.cells[i]) : next;}];},
        useRef(initial: unknown) {const i = hooks.cursor++; if (!(i in hooks.cells)) hooks.cells[i] = {current:initial}; return hooks.cells[i];},
        useCallback: (callback: unknown) => callback,useMemo: (compute: () => unknown) => compute(),
    };
});
import {ContextPanelHostProvider} from "@/app/layout/ContextPanelHost";
type Host = {active: string | null;docked: boolean;fullWidth: boolean;width: number;
    register: (entry:{id:string;width:number;close:()=>void;depart:(proceed:()=>void,cancel:()=>void)=>void})=>()=>void;
    request:(id:string)=>void;release:(id:string)=>void};
function draw(surfaceWidth = 1440,navigationWidth = 260): Host {
    hooks.cursor = 0;
    const tree = ContextPanelHostProvider({target:null,surfaceWidth,navigationWidth,children:null}) as ReactElement<{value:Host}>;
    return tree.props.value;
}
beforeEach(() => {hooks.cells = []; hooks.cursor = 0;});
describe("controlled context-panel coordination", () => {
    it("keeps the outgoing owner until explicit acceptance and rejects a competing opener", () => {
        let accept = () => {},cancel = () => {};
        const outgoingClose = vi.fn(),incomingClose = vi.fn(),competitorClose = vi.fn();
        let host = draw();
        host.register({id:"material",width:400,close:outgoingClose,depart:(yes,no)=>{accept=yes;cancel=no;}});
        host.register({id:"task",width:400,close:incomingClose,depart:yes=>yes()});
        host.register({id:"memory",width:400,close:competitorClose,depart:yes=>yes()});
        host.request("material"); host = draw(); expect(host.active).toBe("material");
        host.request("task"); expect(draw().active).toBe("material");
        host.request("memory"); expect(competitorClose).toHaveBeenCalledExactlyOnceWith("busy");
        const staleAcceptance = accept;
        cancel(); staleAcceptance(); expect(incomingClose).toHaveBeenCalledExactlyOnceWith("guard-refused"); expect(draw().active).toBe("material");
        host.request("task"); accept(); expect(outgoingClose).toHaveBeenCalledExactlyOnceWith("replaced"); expect(draw().active).toBe("task");
    });
    it("cannot activate a removed candidate from an old discard completion", () => {
        let accept = () => {};
        const host = draw();
        host.register({id:"a",width:320,close:vi.fn(),depart:yes=>{accept=yes;}});
        const remove = host.register({id:"b",width:400,close:vi.fn(),depart:yes=>yes()});
        host.request("a"); host.request("b"); remove(); accept();
        expect(draw().active).toBe("a");
    });
    it("bases docking on actual surface allocation and keeps the same active identity", () => {
        const host = draw(); host.register({id:"music",width:300,close:vi.fn(),depart:yes=>yes()}); host.request("music");
        expect(draw(1120,340)).toMatchObject({active:"music",docked:true,fullWidth:false,width:300});
        expect(draw(1119,340)).toMatchObject({active:"music",docked:false,fullWidth:true,width:300});
        expect(draw(1119,0)).toMatchObject({active:"music",docked:true,fullWidth:false,width:300});
        host.release("music"); expect(draw(760)).toMatchObject({active:null,fullWidth:false});
    });
    it.each([300,320,400])("uses full-width mode below the measured allocation for a %ipx panel", width => {
        const host = draw();
        host.register({id:"detail",width,close:vi.fn(),depart:yes=>yes()}); host.request("detail");
        const threshold = 260 + width + 480;
        expect(draw(threshold)).toMatchObject({active:"detail",docked:true,fullWidth:false});
        expect(draw(threshold - 1)).toMatchObject({active:"detail",docked:false,fullWidth:true});
        expect(draw(390)).toMatchObject({active:"detail",docked:false,fullWidth:true});
    });
});
