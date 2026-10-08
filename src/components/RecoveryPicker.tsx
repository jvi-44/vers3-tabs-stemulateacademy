import {
  Calculator,
  FlaskConical,
  BookOpen,
  Languages,
  Palette,
  Music2,
  Dumbbell,
  Check,
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
    <div className="grid grid-cols-4 gap-2.5 pb-1">
      {options.map((c, i) => {
        const hex = COLOUR_HEX[c.name] ?? "#94a3b8";
        const active = value === String(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(String(c.id))}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border-[2.5px] border-[#1b2e1c] transition-all",
              active
                ? "bg-[#c6ef72] shadow-[0_5px_0_#1b2e1c] -translate-y-1 " + (i % 2 ? "rotate-[3deg]" : "-rotate-[3deg]")
                : "bg-white shadow-[0_3px_0_#1b2e1c] hover:-translate-y-0.5 hover:bg-[#fffbea]",
            )}
          >
            <span
              className="w-8 h-8 rounded-full border-[2.5px] border-[#1b2e1c] flex items-center justify-center"
              style={{ backgroundColor: hex }}
            >
              {active && <Check className="w-4 h-4 text-white drop-shadow-[0_1px_0_#1b2e1c]" strokeWidth={4} />}
            </span>
            <span className="text-[11px] font-bold text-[#1b2e1c]">{c.name}</span>
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
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-1">
      {options.map((s, i) => {
        const Icon = SUBJECT_ICON[s.name] ?? BookOpen;
        const active = value === String(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(String(s.id))}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl border-[2.5px] border-[#1b2e1c] text-[#1b2e1c] transition-all",
              active
                ? "bg-[#c6ef72] shadow-[0_5px_0_#1b2e1c] -translate-y-1 " + (i % 2 ? "rotate-[2deg]" : "-rotate-[2deg]")
                : "bg-white shadow-[0_3px_0_#1b2e1c] hover:-translate-y-0.5 hover:bg-[#fffbea]",
            )}
          >
            <span
              className={cn(
                "w-9 h-9 rounded-full border-2 border-[#1b2e1c] flex items-center justify-center",
                active ? "bg-[#7c4dff] text-white" : "bg-[#efe7ff] text-[#5a2fd8]",
              )}
            >
              <Icon size={18} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-bold text-center leading-tight">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
