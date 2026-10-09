// A lesson's game beat: always single player on the first try.

import { useState } from "react";
import { GameShell } from "./kit/GameShell";
import { useGamePlayer } from "./kit/player";
import { GAMES_BY_ID } from "./registry";

export function LessonGame({ beatId, done, onContinue }: { beatId: string; done: boolean; onContinue: (score: number) => void }) {
  const player = useGamePlayer();
  const [runKey, setRunKey] = useState(0);
  const def = GAMES_BY_ID[beatId];
  if (!def) return null;
  return (
    <GameShell
      key={runKey}
      def={def}
      me={player}
      userId={player.userId}
      context="lesson"
      onExit={() => setRunKey((k) => k + 1)}
      onContinue={onContinue}
      finishLabel={done ? "Continue" : "Claim 500 XP + 300 Atoms"}
    />
  );
}
