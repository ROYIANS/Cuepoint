import { useDebouncedDraft } from "@/lib/debouncedDraft";
import { DraftStatus } from "@/components/ui/draft-status";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** One field per draft: unrelated live-query and slot updates cannot reset input. */
export function AssetTextField({ label, value, projectId, draftKey, persist, multiline, placeholder }: {
  label: string;
  value: string;
  projectId: string;
  draftKey: string;
  persist: (value: string, baseline: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const { draft, setDraft, status, error, retry, useLatest } = useDebouncedDraft({
    initialValue: value,
    persist,
    scope: projectId,
    draftKey,
  });
  const Control = multiline ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <Field label={label}>
        <Control value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} />
      </Field>
      <DraftStatus status={status} error={error} onRetry={() => void retry()} onUseLatest={useLatest} />
    </div>
  );
}
