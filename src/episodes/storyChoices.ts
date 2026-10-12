import { getStoryChoices, saveStoryChoices } from "../api/story";
import type { Flags } from "./types";

// What each player chose in earlier episodes. Signed-in students' choices are
// saved on the server; a guest's live only in memory, so nothing is kept.

type Saved = Record<string, Flags>;
const cache = new Map<string, Promise<Saved>>();
const keyFor = (userId?: number) => (userId === undefined ? "guest" : String(userId));

export function loadChoices(userId?: number): Promise<Saved> {
  const key = keyFor(userId);
  let p = cache.get(key);
  if (!p) {
    p =
      userId === undefined
        ? Promise.resolve({})
        : getStoryChoices()
            .then((r) => r.choices)
            .catch(() => ({}));
    cache.set(key, p);
  }
  return p;
}

export async function rememberChoices(userId: number | undefined, beatId: string, flags: Flags) {
  const key = keyFor(userId);
  const saved = await loadChoices(userId);
  cache.set(key, Promise.resolve({ ...saved, [beatId]: flags }));
  if (userId !== undefined) await saveStoryChoices(beatId, flags).catch(() => {});
}
