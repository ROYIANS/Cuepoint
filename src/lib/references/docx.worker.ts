import { parseDocxReference } from "./docx";
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage({ result: await parseDocxReference(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "DOCX 解析失败" }); }
};
