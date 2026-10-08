// Turns the on-screen certificate <svg> into a PNG without any extra
// libraries: every image is inlined as a data URL, the Google fonts are
// embedded as base64 @font-face rules, and the result is drawn onto a canvas.
import { CERT_H, CERT_W } from "./certificateKit";

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800;900&display=swap";

const dataUrlCache = new Map<string, Promise<string>>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let p = dataUrlCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blobToDataUrl);
    p.catch(() => dataUrlCache.delete(url));
    dataUrlCache.set(url, p);
  }
  return p;
}

let fontCssPromise: Promise<string> | null = null;

/** The latin Fredoka + Nunito @font-face rules with the font files inlined. */
export function embeddedFontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const css = await fetch(FONT_CSS_URL).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
      // Keep only the basic latin subset: it covers names and lesson titles
      // and keeps the SVG small.
      const blocks = css.match(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{[^}]*\}/g) ?? [];
      const out: string[] = [];
      for (const block of blocks) {
        const m = block.match(/url\((['"]?)([^)'"]+)\1\)/);
        if (!m) continue;
        const data = await toDataUrl(m[2]);
        out.push(block.replace(m[0], `url(${data})`).replace(/\/\*[^*]*\*\//, ""));
      }
      return out.join("\n");
    })().catch((err) => {
      fontCssPromise = null;
      console.warn("Certificate: could not embed fonts, using fallbacks", err);
      return "";
    });
  }
  return fontCssPromise;
}

async function svgToString(svg: SVGSVGElement, scale: number): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(CERT_W * scale));
  clone.setAttribute("height", String(CERT_H * scale));
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.querySelectorAll("[data-export-skip]").forEach((n) => n.remove());

  const images = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    images.map(async (img) => {
      const href = img.getAttribute("href") ?? img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href) return;
      try {
        img.setAttribute("href", await toDataUrl(new URL(href, location.href).href));
      } catch {
        img.remove();
      }
    }),
  );

  const fontCss = await embeddedFontCss();
  if (fontCss) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }
  return new XMLSerializer().serializeToString(clone);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not draw the certificate"));
    img.src = src;
  });
}

export async function certificateToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const markup = await svgToString(svg, scale);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  const img = await loadImage(src);
  try {
    await img.decode();
  } catch {
    // decode() is optional; onload already fired.
  }
  // Give the browser a moment to apply the embedded fonts inside the image.
  await new Promise((r) => setTimeout(r, 120));
  const canvas = document.createElement("canvas");
  canvas.width = CERT_W * scale;
  canvas.height = CERT_H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the PNG"))), "image/png"),
  );
}

export async function downloadCertificatePng(svg: SVGSVGElement, filename: string) {
  const blob = await certificateToPngBlob(svg, 2);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
