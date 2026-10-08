// Who is playing. App.tsx sets this after login so games (in lessons and in
// the Games tab) know the player's id, name and avatar without prop drilling.

import { useSyncExternalStore } from "react";
import type { PlayerIdentity } from "./live";

let current: PlayerIdentity & { userId?: number } = { id: "guest", name: "Player", avatar: "" };
const listeners = new Set<() => void>();

export function setGamePlayer(p: PlayerIdentity & { userId?: number }) {
  if (p.id === current.id && p.name === current.name && p.avatar === current.avatar) return;
  current = p;
  listeners.forEach((l) => l());
}

export function useGamePlayer() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
