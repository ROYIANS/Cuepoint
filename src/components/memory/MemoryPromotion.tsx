import { useState } from "react";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { MemoryCandidate, MemorySourceRef } from "@/domain/projectMemory";
import { listMemoryCandidates } from "@/db/projectMemories";
import { Button } from "@/components/ui/button";

export function MemoryPromotion({
  projectId,
  source,
  onCandidate,
}: {
  projectId: string;
  source: MemorySourceRef;
  onCandidate: (candidate: MemoryCandidate) => void;
}) {
  const [pending, setPending] = useState(false);
  async function prepare() {
    if (pending) return;
    setPending(true);
    try {
      const candidates = await listMemoryCandidates(
        projectId,
        source.taskId,
        source.summaryId,
        source.summaryRevision,
      );
      const selected = candidates.find(
        (item) =>
          item.ref.itemKind === source.itemKind &&
          item.ref.itemIndex === source.itemIndex &&
          item.ref.itemText === source.itemText,
      );
      if (!selected)
        throw new Error("这条总结来源已发生变化，请重新打开后再试");
      onCandidate(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取总结来源失败");
    } finally {
      setPending(false);
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => void prepare()}
    >
      <BookOpen size={14} />
      {pending ? "读取来源…" : "存为项目记忆"}
    </Button>
  );
}
