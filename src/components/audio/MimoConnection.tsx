import { useState } from "react";
import { upsertConnector } from "@/db/repo";
import type { ConnectorConfig } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Disclosure, DisclosureTitle } from "@/components/audioMusic/controls";
import { errorText } from "@/components/audioMusic/shared";

/** First-use setup stays beside the action; credentials only enter the connector repository. */
export function MimoConnection({ existing, onSaved }: { existing?: ConnectorConfig; onSaved?: () => void }) {
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || "https://api.xiaomimimo.com/v1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="space-y-3 py-3"><p className="text-sm font-medium">连接 MiMo，开始配音</p><p className="text-xs text-muted-foreground">首次填写 API Key，以后所有音频项目自动使用。</p>
    <Input aria-label="MiMo API Key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="粘贴 MiMo API Key" disabled={busy}/>
    <Disclosure><DisclosureTitle>自定义地址</DisclosureTitle><Input aria-label="MiMo Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} disabled={busy}/></Disclosure>
    <Button disabled={busy || !key.trim()} onClick={() => { setBusy(true); setError(""); void (async () => {
      const url = new URL(baseUrl.trim());
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.replace(/\/$/, "").endsWith("/v1")) throw new Error("地址需以 /v1 结尾，且不能包含鉴权信息或查询参数");
      await upsertConnector({ definitionId: "mimo", protocol: "openai-compatible", baseUrl, apiKey: key, label: existing?.label }); setKey(""); onSaved?.();
    })().catch((e: unknown) => setError(errorText(e))).finally(() => setBusy(false)); }}>{busy ? "保存中…" : "保存连接"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
