import { useEffect, useRef } from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function StudioField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;
    const surface = canvas;
    const gfx = context;

    const pointer = { x: -240, y: -240 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let dots: Array<{ x: number; y: number; phase: number }> = [];

    function layout() {
      const area = surface.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(area.width));
      height = Math.max(1, Math.floor(area.height));
      surface.width = Math.floor(width * dpr);
      surface.height = Math.floor(height * dpr);
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      gfx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gap = 32;
      const next: Array<{ x: number; y: number; phase: number }> = [];
      for (let y = gap * 0.5; y < height; y += gap) {
        for (let x = gap * 0.5; x < width; x += gap) {
          next.push({ x, y, phase: (x * 0.015 + y * 0.02) % (Math.PI * 2) });
        }
      }
      dots = next;
    }

    function draw(time: number) {
      gfx.clearRect(0, 0, width, height);

      const glow = gfx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 320);
      glow.addColorStop(0, "rgba(255,255,255,0.08)");
      glow.addColorStop(0.4, "rgba(255,255,255,0.025)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      gfx.fillStyle = glow;
      gfx.fillRect(0, 0, width, height);

      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        const near = Math.max(0, 1 - dist / 240);
        const breathe = 0.5 + 0.5 * Math.sin(time * 0.0007 + dot.phase);
        const alpha = 0.07 + breathe * 0.05 + near * 0.28;
        const radius = 0.85 + near * 1.25;
        gfx.beginPath();
        gfx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        gfx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        gfx.fill();
      }
    }

    layout();
    draw(0);

    if (prefersReducedMotion()) {
      const onResize = () => {
        layout();
        draw(0);
      };
      const observer = new ResizeObserver(onResize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    const onMove = (event: PointerEvent) => {
      const area = surface.getBoundingClientRect();
      pointer.x = event.clientX - area.left;
      pointer.y = event.clientY - area.top;
    };

    let running = true;
    const tick = (time: number) => {
      if (!running) return;
      if (!document.hidden) draw(time);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    const observer = new ResizeObserver(layout);
    observer.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
