// Prints every comic speech bubble as JSON lines for generate.py:
//   {"key": "sophia-1a2b3c4d", "speaker": "sophia", "text": "..."}
// Usage: node scripts/comic-voices/export-lines.mjs > lines.jsonl
import { build } from "esbuild";

const entry = `
  export { COMIC_STRIPS } from "./src/data/comicStrips.ts";
  export { comicLineKey } from "./src/data/comicAudioKey.ts";
`;
const out = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);

const seen = new Set();
for (const strip of Object.values(mod.COMIC_STRIPS)) {
  for (const panel of strip.panels) {
    for (const b of panel.bubbles) {
      const key = mod.comicLineKey(b.speaker, b.text);
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(JSON.stringify({ key, speaker: b.speaker, text: b.text }));
    }
  }
}
