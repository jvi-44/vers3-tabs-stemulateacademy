// Client for live game rooms (see server/gameRooms.js).
// Server → client: Server-Sent Events. Client → server: POST actions.

import { useCallback, useEffect, useRef, useState } from "react";

export interface LivePlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  score: number;
  progress: number;
  done: boolean;
  connected: boolean;
}

export interface LiveRoom {
  code: string;
  gameId: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  seed: number;
  startedAt: number | null;
  players: LivePlayer[];
}

export interface PlayerIdentity {
  id: string;
  name: string;
  avatar: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't reach the game server. Is it running?");
  return data as T;
}

export async function listRooms(gameId: string): Promise<LiveRoom[]> {
  const res = await fetch(`/api/game-rooms?gameId=${encodeURIComponent(gameId)}`);
  if (!res.ok) throw new Error("Couldn't reach the game server. Is it running?");
  return (await res.json()).rooms;
}

export function createRoom(gameId: string, player: PlayerIdentity) {
  return post<{ room: LiveRoom }>("/game-rooms", { gameId, player }).then((r) => r.room);
}

export function joinRoom(code: string, player: PlayerIdentity) {
  return post<{ room: LiveRoom }>(`/game-rooms/${code.toUpperCase()}/join`, { player }).then((r) => r.room);
}

export type RelayHandler = (from: string, data: any) => void;

/**
 * Subscribes to one room. Returns the latest room snapshot and an `act`
 * function for actions (ready, start, progress, finish, rematch, relay, leave).
 */
export function useLiveRoom(code: string | null, me: PlayerIdentity) {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const relayHandlers = useRef(new Set<RelayHandler>());

  useEffect(() => {
    if (!code) {
      setRoom(null);
      return;
    }
    const es = new EventSource(`/api/game-rooms/${code}/events?playerId=${encodeURIComponent(me.id)}`);
    es.addEventListener("room", (e) => setRoom(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("relay", (e) => {
      const { from, data } = JSON.parse((e as MessageEvent).data);
      relayHandlers.current.forEach((h) => h(from, data));
    });
    es.onerror = () => setError("Connection to the game server dropped. Trying again…");
    es.onopen = () => setError(null);
    return () => es.close();
  }, [code, me.id]);

  const act = useCallback(
    (type: string, payload?: unknown) => {
      if (!code) return Promise.resolve(null);
      return post<{ room?: LiveRoom }>(`/game-rooms/${code}/action`, { playerId: me.id, type, payload })
        .then((r) => {
          if (r.room) setRoom(r.room);
          return r.room ?? null;
        })
        .catch((e: Error) => {
          setError(e.message);
          return null;
        });
    },
    [code, me.id],
  );

  const onRelay = useCallback((h: RelayHandler) => {
    relayHandlers.current.add(h);
    return () => {
      relayHandlers.current.delete(h);
    };
  }, []);

  return { room, error, act, onRelay };
}

export type LiveConnection = ReturnType<typeof useLiveRoom>;
