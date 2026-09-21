import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createFileMaterial } from "@/db/materials";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MaterialScopeSelect, parseScope, useMaterialDraftGuard } from "./MaterialControls";

export const MATERIAL_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,audio/flac,audio/aac,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.pdf,.docx";
export function MaterialImportDialog({ initialScope, onClose, onImported }: { initialScope: string; onClose: () => void; onImported: (id: string) => void }) {
  const [scope, setScope] = useState(initialScope);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const filePicker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const { requestClose, dialog } = useMaterialDraftGuard(files.length > 0, pending);
  async function save() {
    if (pendingRef.current || !files.length) return;
    pendingRef.current = true; setPending(true); setError("");
    let remaining = [...files]; let lastId: string | undefined;
    try {
      for (const file of files) {
        setProgress(`正在保存 ${file.name}`);
        lastId = (await createFileMaterial(file, parseScope(scope))).id;
        remaining = remaining.slice(1); setFiles(remaining);
      }
      if (lastId) onImported(lastId);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "导入失败，请重试。已保存的文件不会重复导入。"); }
    finally { pendingRef.current = false; setPending(false); setProgress(""); }
  }
  return <><Dialog open onOpenChange={(open) => { if (!open) requestClose(onClose); }}><DialogContent className="material-dialog"><DialogHeader><DialogTitle>导入媒体与资料</DialogTitle><DialogDescription>素材按选择的位置保存。项目内素材需要明确提升后，才会出现在共享素材中。</DialogDescription></DialogHeader>
    <label className="material-field">保存位置<MaterialScopeSelect value={scope} onChange={setScope} disabled={pending} /></label>
    <div className="material-upload"><Upload aria-hidden /><Button variant="outline" disabled={pending} onClick={() => filePicker.current?.click()}>选择文件</Button><span>图片、视频、音频、TXT、Markdown、PDF 或 DOCX</span><input ref={filePicker} hidden type="file" multiple accept={MATERIAL_ACCEPT} disabled={pending} onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setError(""); }} /></div>
    {files.length > 0 && <ul className="material-file-list">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></li>)}</ul>}
    {error && <p role="alert" className="material-error">{error}</p>}{pending && <p role="status" className="material-muted">{progress}</p>}
    <DialogFooter><Button variant="outline" disabled={pending} onClick={() => requestClose(onClose)}>取消</Button><Button disabled={pending || !files.length} onClick={() => void save()}>{pending ? "正在导入…" : `导入${files.length ? ` ${files.length} 个文件` : ""}`}</Button></DialogFooter>
  </DialogContent></Dialog>{dialog}</>;
}
