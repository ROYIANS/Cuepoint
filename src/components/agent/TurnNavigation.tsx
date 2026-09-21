import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ChatMessage } from "@/domain/types";
import { buildChatTurns, getActiveTurnIndex, MIN_TURNS_FOR_NAVIGATION } from "@/lib/agent/chatTurns";
import "./turnNavigation.css";

export function TurnNavigation({ messages, listRef, contentRef, onNavigate }: {
  messages: readonly ChatMessage[];
  listRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onNavigate: () => void;
}) {
  const turns = useMemo(() => buildChatTurns(messages), [messages]);
  const anchorsKey = JSON.stringify(turns.map((turn) => turn.id));
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState<{ index: number; top: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const offsets = useRef<number[]>([]);
  const anchors = useRef<HTMLElement[]>([]);
  const tooltipId = useId();

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) setPreview(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  useLayoutEffect(() => {
    setPreview(null);
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content) return;
    let frame = 0;
    const updateActive = () => {
      const header = parseFloat(getComputedStyle(list).getPropertyValue("--agent-chat-header-height")) || 52;
      setActive(getActiveTurnIndex(offsets.current, list.scrollTop + header + 16));
    };
    const measure = () => {
      frame = 0;
      anchors.current = [...content.querySelectorAll<HTMLElement>("[data-turn-anchor]")];
      const top = list.getBoundingClientRect().top;
      offsets.current = anchors.current.map((anchor) => anchor.getBoundingClientRect().top - top + list.scrollTop);
      updateActive();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    observer.observe(list);
    list.addEventListener("scroll", updateActive, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      list.removeEventListener("scroll", updateActive);
    };
  }, [anchorsKey, listRef, contentRef]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const button = rail?.querySelectorAll<HTMLButtonElement>("button")[active];
    if (!rail || !button || rail.matches(":hover") || rail.contains(document.activeElement)) return;
    if (button.offsetTop < rail.scrollTop) rail.scrollTop = button.offsetTop;
    else if (button.offsetTop + button.offsetHeight > rail.scrollTop + rail.clientHeight) rail.scrollTop = button.offsetTop + button.offsetHeight - rail.clientHeight;
  }, [active]);

  if (turns.length < MIN_TURNS_FOR_NAVIGATION) return null;
  const showPreview = (index: number, button: HTMLButtonElement) => {
    const nav = navRef.current;
    if (!nav) return;
    setPreview({ index, top: Math.max(0, Math.min(button.getBoundingClientRect().top - nav.getBoundingClientRect().top, nav.clientHeight - 156)) });
  };
  const selected = preview && turns[preview.index];
  return <nav ref={navRef} className="agent-turn-navigation" aria-label="对话轮次快速定位"
    onMouseLeave={() => { setHovered(null); if (!navRef.current?.contains(document.activeElement)) setPreview(null); }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setPreview(null); setHovered(null); } }}>
    <div ref={railRef} className="agent-turn-rail" onMouseLeave={() => setHovered(null)} onScroll={() => { setPreview(null); setHovered(null); }}>
      {turns.map((turn, index) => <button key={turn.id} type="button" className="agent-turn-tick" data-turn-id={turn.id}
        aria-label={`第 ${index + 1} 轮：${turn.question}`} aria-current={active === index ? "location" : undefined}
        aria-describedby={preview?.index === index ? tooltipId : undefined}
        data-hover-distance={hovered === null ? undefined : Math.min(hovered === index ? 0 : Math.abs(hovered - index), 4)}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") { setHovered(index); showPreview(index, event.currentTarget); } }}
        onFocus={(event) => showPreview(index, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setPreview(null); return; }
          let next: number;
          if (event.key === "ArrowDown") next = Math.min(turns.length - 1, index + 1);
          else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = turns.length - 1;
          else return;
          event.preventDefault();
          const button = railRef.current?.querySelectorAll<HTMLButtonElement>("button")[next];
          if (button) {
            const rail = railRef.current!;
            if (button.offsetTop < rail.scrollTop) rail.scrollTop = button.offsetTop;
            else if (button.offsetTop + button.offsetHeight > rail.scrollTop + rail.clientHeight) rail.scrollTop = button.offsetTop + button.offsetHeight - rail.clientHeight;
            button.focus({ preventScroll: true });
          }
        }}
        onClick={(event) => {
          const list = listRef.current;
          const anchor = anchors.current.find((element) => element.dataset.turnAnchor === turn.id);
          if (!list || !anchor) return;
          onNavigate();
          const header = parseFloat(getComputedStyle(list).getPropertyValue("--agent-chat-header-height")) || 52;
          list.scrollTop += anchor.getBoundingClientRect().top - list.getBoundingClientRect().top - header - 16;
          setActive(index);
          // Touch receives the same preview as keyboard/hover; tapping outside dismisses it.
          showPreview(index, event.currentTarget);
        }}><span aria-hidden /></button>)}
    </div>
    {selected && preview && <div id={tooltipId} role="tooltip" className="agent-turn-preview" style={{ top: preview.top }}>
      <span className="agent-turn-preview-label">第 {preview.index + 1} 轮</span>
      <p className="agent-turn-preview-question">{selected.question}</p>
      <p className="agent-turn-preview-answer">{selected.answer}</p>
    </div>}
  </nav>;
}
