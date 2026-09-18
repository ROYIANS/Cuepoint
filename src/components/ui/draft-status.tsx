import type { DraftSaveStatus } from "@/lib/debouncedDraft";

export function DraftStatus({
  status,
  error,
  onRetry,
}: {
  status: DraftSaveStatus;
  error?: unknown;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <span role="alert" className="text-destructive text-[11px]">
        {error instanceof Error ? error.message : "保存失败"}
        {" · "}
        <button type="button" className="underline" onClick={onRetry}>
          重试
        </button>
      </span>
    );
  }
  return (
    <span role="status" className="text-muted-foreground text-[11px]">
      {status === "saved" ? "已保存" : "保存中…"}
    </span>
  );
}
