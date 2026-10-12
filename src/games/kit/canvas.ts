// Small helpers for the canvas games (Drippy's Water Cycle Dash, Asteroid Blasters):
// a resize-aware canvas with a requestAnimationFrame loop, image loading and
// a fixed-step clock so every player's bots move the same way.

import { useEffect, useRef } from "react";

export interface Frame {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels. */
  w: number;
  h: number;
  /** Seconds since the last frame (capped). */
  dt: number;
  now: number;
}

/**
 * Draws `frame` every animation frame into a canvas that fills its parent.
 * `frame` is read from a ref, so it can change every render without restarting the loop.
 */
export function useCanvasLoop(frame: (f: Frame) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (w > 0 && h > 0) frameRef.current({ ctx, w, h, dt, now: t / 1000 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return canvasRef;
}

const imageCache = new Map<string, HTMLImageElement>();
/** An <img> that may still be loading; draw it only when `complete`. */
export function loadImage(src: string) {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text that shrinks to fit `maxW`. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight = 700) {
  let s = size;
  ctx.font = `${weight} ${s}px Fredoka, Nunito, system-ui, sans-serif`;
  while (s > 8 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${weight} ${s}px Fredoka, Nunito, system-ui, sans-serif`;
  }
  ctx.fillText(text, x, y);
}

/** Splits text over lines that fit `maxW` with the current font. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Fisher–Yates with a seeded random. */
export function shuffled<T>(arr: T[], rnd: () => number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
