import {
  Calculator,
  FlaskConical,
  BookOpen,
  Languages,
  Palette,
  Music2,
  Dumbbell,
  Circle,
} from "lucide-react";
import { cn } from "./ui/utils";
import type { ReferenceOption } from "../types-auth";

// --- Colour blocks -----------------------------------------------------
const COLOUR_HEX: Record<string, string> = {
  Red: "#ef4444",
  Orange: "#f97316",
  Yellow: "#eab308",
  Green: "#22c55e",
  Blue: "#3b82f6",
  Purple: "#a855f7",
  Pink: "#ec4899",
};

export function ColourBlockPicker({
  options,
  value,
  onChange,
}: {
  options: ReferenceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {options.map((c) => {
        const hex = COLOUR_HEX[c.name] ?? "#94a3b8";
        const active = value === String(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(String(c.id))}
            className={cn(
              "flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border-2 transition-all",
              active ? "border-lime-500 bg-lime-50 scale-105" : "border-lime-100 bg-white hover:border-lime-300",
            )}
          >
            <span
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: hex }}
            >
              {active && <Circle className="w-3 h-3 fill-white text-white" />}
            </span>
            <span className="text-[10px] font-bold text-slate-600">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Subject blocks ------------------------------------------------------
const SUBJECT_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Mathematics: Calculator,
  Science: FlaskConical,
  English: BookOpen,
  "Mother Tongue": Languages,
  Art: Palette,
  Music: Music2,
  "Physical Education": Dumbbell,
};

export function SubjectBlockPicker({
  options,
  value,
  onChange,
}: {
  options: ReferenceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {options.map((s) => {
        const Icon = SUBJECT_ICON[s.name] ?? BookOpen;
        const active = value === String(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(String(s.id))}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all",
              active
                ? "border-lime-500 bg-lime-50 text-lime-700 scale-105"
                : "border-lime-100 bg-white text-slate-500 hover:border-lime-300",
            )}
          >
            <Icon size={22} className={active ? "text-lime-600" : "text-slate-400"} />
            <span className="text-[10px] font-bold text-center leading-tight">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
