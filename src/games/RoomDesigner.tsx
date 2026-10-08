import type { GameProps } from "./kit/types";

export function RoomDesigner({ finish }: GameProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-white">
      <button className="game-btn bg-yellow-400 text-slate-900" onClick={() => finish(50)}>Coming soon (finish)</button>
    </div>
  );
}
