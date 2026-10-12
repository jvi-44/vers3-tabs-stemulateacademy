import { describe, expect, it } from "vitest";
import { allLines, brokenLinks, carriedFlags, matches, resolveNext } from "../episodes/engine";
import { EPISODES } from "../episodes/stories";
import { MINI_GAMES } from "../episodes/minigames";
import type { Episode, Flags } from "../episodes/types";

/** Every flag value each choice can set, so we can walk all paths. */
function walk(ep: Episode) {
  const seen = new Set<string>();
  const ends: Flags[] = [];
  const go = (id: string, flags: Flags, depth: number) => {
    expect(depth).toBeLessThan(60);
    const node = ep.nodes[id];
    seen.add(id);
    if (node.type === "end") return ends.push(flags);
    if (node.type === "choice") {
      const options = node.options.filter((o) => matches(o.when, flags));
      expect(options.length, `${ep.beatId}/${id} has no options`).toBeGreaterThan(0);
      for (const o of options) {
        const f = { ...flags, ...o.set };
        go(resolveNext(o.next, f), f, depth + 1);
      }
      return;
    }
    if (node.type === "game") {
      expect(MINI_GAMES[node.game]).toBeTruthy();
      go(resolveNext(node.next, { ...flags, ...node.setOnWin }), { ...flags, ...node.setOnWin }, depth + 1);
      go(resolveNext(node.next, flags), flags, depth + 1);
      return;
    }
    go(resolveNext(node.next, flags), flags, depth + 1);
  };
  go(ep.start, {}, 0);
  return { seen, ends };
}

describe("intro episodes", () => {
  it.each(EPISODES.map((e) => [e.title, e]))("%s has no broken links and every node is reachable", (_, ep) => {
    expect(brokenLinks(ep)).toEqual([]);
    const { seen, ends } = walk(ep);
    expect([...Object.keys(ep.nodes)].filter((id) => !seen.has(id))).toEqual([]);
    expect(ends.length).toBeGreaterThan(0);
  });

  it("every voiced line is short enough to read on a phone", () => {
    for (const ep of EPISODES) for (const l of allLines(ep)) expect(l.text.length, l.text).toBeLessThanOrEqual(160);
  });

  it("later episodes remember your buddy from episode 1", () => {
    const [first, second] = EPISODES;
    expect(carriedFlags(EPISODES, { [first.beatId]: { buddy: "emily", style: "bold" } }, second)).toEqual({ buddy: "emily" });
    expect(carriedFlags(EPISODES, { [first.beatId]: { buddy: "emily" } }, first)).toEqual({});
  });
});
