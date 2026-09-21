import { useState } from "react";
import { toast } from "sonner";
import { patchShot } from "@/db/repo";
import { useDebouncedDraft } from "@/lib/debouncedDraft";
import { parseDurationInput } from "@/lib/durationInput";
import { DraftStatus } from "@/components/ui/draft-status";
import { Input } from "@/components/ui/input";

export function DurationInput({ projectId, shotId, value }: { projectId: string; shotId: string; value?: number }) {
  const [raw, setRaw] = useState<string | null>(null);
  const { draft, setDraft, status, error, retry, useLatest } = useDebouncedDraft({
    initialValue: value ?? 0,
    persist: durationSec => patchShot(shotId, { durationSec }),
    scope: projectId,
    draftKey: `shot:${shotId}:durationSec`,
  });
  const text = raw ?? String(draft);
  const invalid = parseDurationInput(text) === undefined;
  return <div className="w-full">
    <Input
      value={text}
      inputMode="decimal"
      placeholder="秒"
      aria-label="时长（秒）"
      aria-invalid={invalid}
      onFocus={() => setRaw(text)}
      onChange={event => {
        const next = event.target.value;
        setRaw(next);
        const durationSec = parseDurationInput(next);
        if (durationSec !== undefined) setDraft(durationSec);
      }}
      onBlur={() => {
        if (invalid) toast.error("请输入大于或等于 0 的有效秒数");
        // Keep punctuation during typing; the serialized numeric draft survives
        // blur, save failures, row unmounting and the project backup barrier.
        if (!invalid) setRaw(null);
      }}
      className="h-8 w-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
    />
    {status === "error" && <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest} />}
  </div>;
}
