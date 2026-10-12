// Stable file name for a recorded story line. Shared by the episode player and
// scripts/story-voices, so editing a line's text automatically falls back to
// the browser voice until the line is re-recorded.
export function storyLineKey(speaker: string, text: string): string {
  // 32-bit FNV-1a over "speaker|text", as 8 hex chars.
  let h = 0x811c9dc5;
  const s = `${speaker}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${speaker}-${h.toString(16).padStart(8, "0")}`;
}
