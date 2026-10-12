// Prints every voiced line of the intro episodes as JSON lines for generate.py:
//   {"key": "sophia-1a2b3c4d", "speaker": "sophia", "text": "..."}
// Usage: node scripts/story-voices/export-lines.mjs > lines.jsonl
import { build } from "esbuild";

const entry = `
  export { EPISODES } from "./src/episodes/stories/index.ts";
  export { allLines } from "./src/episodes/engine.ts";
  export { storyLineKey } from "./src/episodes/audioKey.ts";
`;
const out = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);

// The player's own lines are shown, not voiced; the narrator is a caption.
const SILENT = new Set(["you", "narrator"]);
const seen = new Set();
for (const ep of mod.EPISODES) {
  for (const line of mod.allLines(ep)) {
    if (SILENT.has(line.speaker)) continue;
    const key = mod.storyLineKey(line.speaker, line.text);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(JSON.stringify({ key, speaker: line.speaker, text: line.text }));
  }
}
