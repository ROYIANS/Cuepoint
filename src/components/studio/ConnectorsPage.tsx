import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plug } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { db } from "@/db/database";
import { deleteConnector, upsertConnector } from "@/db/repo";
import type { ConnectorConfig, ConnectorDefinitionId } from "@/domain/types";
import { CONNECTOR_CATALOG, type ConnectorDefinition } from "@/lib/ai/catalog";
import { maskApiKey } from "@/lib/ai/openaiCompatible";
import { listConnectorModels, testConnectorConnection } from "@/lib/ai/connectors";
import { cn } from "@/lib/utils";

type EditorState = {
  definition: ConnectorDefinition;
  existing?: ConnectorConfig;
};

export function ConnectorsPage() {
  const connectors = useLiveQuery(() => db.connectors.toArray(), []) ?? [];
  const byDefinition = useMemo(() => {
    const map = new Map<ConnectorDefinitionId, ConnectorConfig>();
    for (const connector of connectors) {
      map.set(connector.definitionId, connector);
    }
    return map;
  }, [connectors]);

  const [editor, setEditor] = useState<EditorState>();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [probeModels, setProbeModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [probing, setProbing] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEditor(definition: ConnectorDefinition, existing?: ConnectorConfig) {
    setEditor({ definition, existing });
    setBaseUrl(existing?.baseUrl ?? definition.defaultBaseUrl);
    setApiKey("");
    setProbeModels([]);
  }

  function closeEditor() {
    setEditor(undefined);
    setProbeModels([]);
    setTesting(false);
    setProbing(false);
    setSaving(false);
  }

  function resolveApiKey(): string {
    if (apiKey.trim()) return apiKey.trim();
    return editor?.existing?.apiKey ?? "";
  }

  async function handleProbeModels() {
    if (!editor) return;
    setProbing(true);
    try {
      const result = await listConnectorModels({
        definitionId: editor.definition.id,
        baseUrl,
        apiKey: resolveApiKey(),
      });
      if (!result.ok) {
        toast.error(result.message);
        setProbeModels([]);
        return;
      }
      setProbeModels(result.models);
      toast.success(
        editor.definition.id === "aihubmix"
          ? `已获取 ${result.models.length} 个公开模型；API Key 请通过测试连接验证`
          : result.models.length > 0
          ? `探活成功，可见 ${result.models.length} 个模型`
          : "探活成功，但接口未返回模型列表",
      );
    } finally {
      setProbing(false);
    }
  }

  async function handleTest() {
    if (!editor) return;
    setTesting(true);
    try {
      const result = await testConnectorConnection({
        definitionId: editor.definition.id,
        baseUrl,
        apiKey: resolveApiKey(),
      });
      if (result.ok) {
        const detail =
          result.via === "models" && result.modelCount != null
            ? `（${result.modelCount} 个模型）`
            : "";
        toast.success(result.via === "authenticated-read" ? "鉴权读取成功；具体模型权限以实际调用为准" : `连接成功${detail}`);
        if (result.via === "models") {
          const listed = await listConnectorModels({
            definitionId: editor.definition.id,
            baseUrl,
            apiKey: resolveApiKey(),
          });
          if (listed.ok) setProbeModels(listed.models);
        }
      } else {
        toast.error(result.message);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      await upsertConnector({
        definitionId: editor.definition.id,
        protocol: editor.definition.protocol,
        baseUrl,
        apiKey: resolveApiKey(),
        label: editor.definition.title,
      });
      toast.success("已保存连接");
      closeEditor();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect(config: ConnectorConfig) {
    try {
      await deleteConnector(config.id);
      toast.success("已断开连接");
      closeEditor();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "断开失败");
    }
  }

  return (
    <div className="px-10 py-8">
      <div className="max-w-3xl">
        <h1 className="font-display text-[28px] leading-none tracking-tight">连接</h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
          密钥仅保存在本机，配置一次后工作室与后续 Agent 共用。不会写入项目备份 ZIP。
          具体聊天用哪个模型，在 Agent 对话里选择。
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {CONNECTOR_CATALOG.map((definition) => {
            const existing = byDefinition.get(definition.id);
            const connected = Boolean(existing);
            return (
              <Card
                key={definition.id}
                className={cn(
                  "gap-4 py-5 shadow-none",
                  connected ? "border-brand/35 bg-brand/[0.04]" : "bg-card/80",
                )}
              >
                <CardHeader className="px-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="bg-muted text-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold tracking-wide"
                      aria-hidden
                    >
                      {definition.mark}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{definition.title}</CardTitle>
                      <CardDescription className="mt-1.5 leading-5">
                        {definition.blurb}
                      </CardDescription>
                    </div>
                  </div>
                  <CardAction>
                    {connected ? (
                      <Badge
                        variant="outline"
                        className="border-brand/40 bg-brand/10 text-brand gap-1"
                      >
                        <Check className="size-3" strokeWidth={2.5} />
                        已连接
                      </Badge>
                    ) : (
                      <Badge variant="secondary">未连接</Badge>
                    )}
                  </CardAction>
                </CardHeader>
                <CardFooter className="justify-end gap-2 px-5">
                  {connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditor(definition, existing)}
                    >
                      编辑
                    </Button>
                  ) : (
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={() => openEditor(definition)}
                    >
                      <Plug className="size-3.5" />
                      安装
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.existing ? "编辑连接" : "安装连接"}</DialogTitle>
            <DialogDescription>
              {editor?.definition.id === "aihubmix"
                ? "AIHubMix · 聊天、图像与视频共用此连接。模型目录公开可读；测试连接仅验证任务列表读取权限，不发起生成。"
                : editor?.definition.id === "apimart"
                ? "APIMart · 聊天、图像与视频共用此连接。测试连接仅查询模型，不发起生成。"
                : `${editor?.definition.title ?? ""} · OpenAI 兼容协议。此处只配置接入点；模型在聊天里选。`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Base URL">
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={editor?.definition.defaultBaseUrl}
                autoComplete="off"
              />
            </Field>
            <Field label="API Key">
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  editor?.existing
                    ? `已保存 ${maskApiKey(editor.existing.apiKey)}（留空则保持）`
                    : "sk-…"
                }
                autoComplete="off"
              />
            </Field>
            {probeModels.length > 0 ? (
              <div className="bg-muted/40 rounded-lg border px-3 py-2">
                <p className="text-muted-foreground text-xs">
                  {editor?.definition.id === "aihubmix" ? "公开模型目录（前 12 个，不代表 Key 权限）" : "探活可见模型（前 12 个）"}
                </p>
                <p className="mt-1 text-xs leading-5 break-all">
                  {probeModels.slice(0, 12).join(" · ")}
                  {probeModels.length > 12 ? ` · …共 ${probeModels.length} 个` : ""}
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {editor?.existing ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleDisconnect(editor.existing!)}
                >
                  断开
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={testing || saving || probing}
                onClick={() => void handleProbeModels()}
              >
                {probing ? "拉取中…" : editor?.definition.id === "aihubmix" ? "获取公开模型" : "拉取模型探活"}
              </Button>
              <Button
                variant="outline"
                disabled={testing || saving || probing}
                onClick={() => void handleTest()}
              >
                {testing ? "测试中…" : "测试连接"}
              </Button>
              <Button
                variant="brand"
                disabled={testing || saving || probing}
                onClick={() => void handleSave()}
              >
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
