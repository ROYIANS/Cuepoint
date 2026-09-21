import { Markdown } from "@lobehub/ui";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatThinkingTitle } from "@/lib/thinkingTitle";

const THINKING_MARKDOWN_PROPS = { variant: "chat" as const };

/**
 * Collapsible reasoning block above the assistant answer.
 * Auto-opens when reasoning becomes active; auto-collapses when it ends
 * (first answer token). After that, the user can toggle freely — we do not
 * re-force closed on every render (that broke re-expand with Accordion).
 */
export function ThinkingPanel({
  reasoning,
  active,
  durationMs,
}: {
  reasoning: string;
  active: boolean;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(active);
  const panelId = useId();
  const prevActive = useRef(active);

  useEffect(() => {
    const wasActive = prevActive.current;
    if (active && !wasActive) setOpen(true);
    if (!active && wasActive) setOpen(false);
    prevActive.current = active;
  }, [active]);

  const title = formatThinkingTitle(active, durationMs);

  return (
    <div className="agent-thinking-panel">
      <button
        type="button"
        className="agent-thinking-header"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="agent-thinking-title">{title}</span>
        <ChevronDown
          className={
            open
              ? "agent-thinking-chevron agent-thinking-chevron--open"
              : "agent-thinking-chevron"
          }
          size={14}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="agent-thinking-content">
          <Markdown {...THINKING_MARKDOWN_PROPS} className="agent-thinking-body">
            {reasoning}
          </Markdown>
        </div>
      ) : null}
    </div>
  );
}
