import {StrictMode} from "react";
import type {ComponentProps} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {ClickSpark} from "@/components/ui/click-spark";
import {instrument} from "./instrumentation";

const meter = instrument();
const root = createRoot(document.getElementById("root")!);
type Options = Omit<ComponentProps<typeof ClickSpark>, "children">;
let options: Options = {};
let childClicks = 0;
let parentClicks = 0;
let strict = false;
const render = () => {
  const content = <div id="host" onClick={() => parentClicks++}>
    <ClickSpark {...options}><button id="child" onClick={() => childClicks++}>Click child</button></ClickSpark>
  </div>;
  flushSync(() => root.render(strict ? <StrictMode>{content}</StrictMode> : content));
};
const api = {
  mount(next: Options = {}, strictMode = false) { options = next; strict = strictMode; render(); },
  update(next: Options) { options = {...options, ...next}; render(); },
  unmount() { flushSync(() => root.render(null)); },
  visibility: meter.visibility,
  resize(width: number, height: number) {
    const host = document.getElementById("host")!; host.style.width = `${width}px`; host.style.height = `${height}px`;
  },
  click(x = 140, y = 90, count = 1) {
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const child = document.getElementById("child")!;
    for (let i = 0; i < count; i++) child.dispatchEvent(new MouseEvent("click", {bubbles: true, clientX: rect.left + x, clientY: rect.top + y}));
  },
  read() {
    const canvas = document.querySelector("canvas");
    const ctx = canvas?.getContext("2d");
    const pixels = canvas && ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : [];
    let paintedPixels = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) paintedPixels++;
    return {...meter.read(), childClicks, parentClicks, paintedPixels,
      canvas: canvas ? {width: canvas.width, height: canvas.height, rect: canvas.getBoundingClientRect().toJSON(),
        ariaHidden: canvas.getAttribute("aria-hidden"), pointerEvents: getComputedStyle(canvas).pointerEvents} : null};
  },
};
declare global { interface Window { e05: typeof api } }
window.e05 = api;
api.mount();
