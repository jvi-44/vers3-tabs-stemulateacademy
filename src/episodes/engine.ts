import type { CastMember, Cond, Episode, Flags, Line, Next, StoryNode } from "./types";

/** True when every key in `cond` matches `flags` (null means "not set"). */
export function matches(cond: Cond | undefined, flags: Flags): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(([k, v]) => (v === null ? flags[k] === undefined : flags[k] === v));
}

export function resolveNext(next: Next, flags: Flags): string {
  if (typeof next === "string") return next;
  const hit = next.find((r) => matches(r.when, flags));
  if (!hit) throw new Error("No matching route");
  return hit.to;
}

export function linesFor(lines: Line[] | undefined, flags: Flags): Line[] {
  return (lines ?? []).filter((l) => matches(l.when, flags));
}

export function castFor(node: StoryNode, flags: Flags): CastMember[] {
  return (node.cast ?? []).filter((c) => matches(c.when, flags));
}

export function recapFor(ep: Episode, flags: Flags): string[] {
  return ep.recap.filter((r) => matches(r.when, flags)).map((r) => r.text);
}

/** Every line any path through the episode can say (for recording voices). */
export function allLines(ep: Episode): Line[] {
  const out: Line[] = [];
  for (const node of Object.values(ep.nodes)) {
    if (node.type === "talk" || node.type === "end") out.push(...node.lines);
    if (node.type === "choice" && node.prompt) out.push(node.prompt);
    if (node.type === "game") out.push(...(node.intro ?? []), ...node.win, ...node.lose);
  }
  return out;
}

/** Checks that every route points at a real node (used by the tests). */
export function brokenLinks(ep: Episode): string[] {
  const ids = new Set(Object.keys(ep.nodes));
  const targets = (n: Next) => (typeof n === "string" ? [n] : n.map((r) => r.to));
  const bad: string[] = [];
  if (!ids.has(ep.start)) bad.push(`start -> ${ep.start}`);
  for (const [id, node] of Object.entries(ep.nodes)) {
    const nexts = node.type === "choice" ? node.options.flatMap((o) => targets(o.next)) : node.type === "end" ? [] : targets(node.next);
    for (const t of nexts) if (!ids.has(t)) bad.push(`${id} -> ${t}`);
  }
  return bad;
}

/** Flags earlier episodes saved that this story can react to (e.g. your buddy). */
export function carriedFlags(episodes: Episode[], saved: Record<string, Flags>, current: Episode): Flags {
  const out: Flags = {};
  for (const ep of episodes) {
    if (ep.beatId === current.beatId || ep.number > current.number) continue;
    for (const key of ep.carries ?? []) {
      const v = saved[ep.beatId]?.[key];
      if (v !== undefined) out[key] = v;
    }
  }
  return out;
}
