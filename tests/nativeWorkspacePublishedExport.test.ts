import {afterEach, expect, it, vi} from "vitest";
import {native} from "../apps/desktop/ui/bridge";
const invoke=vi.fn();

afterEach(()=>{invoke.mockReset();vi.unstubAllGlobals();});

it("retained actual export bridge preserves publication, displays a safe warning and never retries",async()=>{
  invoke.mockRejectedValue({code:"published",message:"File already saved; fileSync failed at /private/export"});
  vi.stubGlobal("window",{__TAURI_INTERNALS__:{invoke}});
  await expect(native.request({type:"export",assetId:"asset-1"})).rejects.toMatchObject({
    published:true,code:"published",message:"文件已保存，但系统未能确认保存收尾。请检查已保存的文件。",
  });
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith("workspace_request",{request:expect.objectContaining({action:{type:"export",assetId:"asset-1"}})},undefined);
  expect(native.active.size).toBe(0);
});

it("retained bridge leaves unrelated native failures unchanged",async()=>{
  const error={code:"canceled",message:"canceled"};
  invoke.mockRejectedValue(error);
  vi.stubGlobal("window",{__TAURI_INTERNALS__:{invoke}});
  await expect(native.request({type:"export",assetId:"asset-1"})).rejects.toBe(error);
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(native.active.size).toBe(0);
});
