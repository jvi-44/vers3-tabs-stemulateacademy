import { useState } from "react";
import { X, Award, Printer } from "lucide-react";
import { StembotPattern } from "./StembotPattern";
import stemulateLogo from "../assets/stemulate_logo.png";
import { cn } from "./ui/utils";

const ACCENTS = [
  { name: "Lime", hex: "#84cc16" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Violet", hex: "#8b5cf6" },
];

export function Certificate({
  studentName,
  moduleName,
  onClose,
}: {
  studentName: string;
  moduleName: string;
  onClose: () => void;
}) {
  const [accent, setAccent] = useState(ACCENTS[0].hex);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 print:bg-white print:p-0">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden relative print:shadow-none print:rounded-none">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-white/90 rounded-full p-1.5 text-slate-500 hover:text-slate-800 print:hidden"
        >
          <X size={18} />
        </button>

        {/* Certificate body */}
        <div className="relative overflow-hidden p-10 text-center" style={{ minHeight: 420 }}>
          <StembotPattern className="opacity-10" />
          <div
            className="absolute inset-3 rounded-2xl border-4 pointer-events-none"
            style={{ borderColor: accent }}
          />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <img src={stemulateLogo} alt="" className="w-12 h-12 object-contain" />
            <p className="text-xs font-black tracking-[0.3em] uppercase" style={{ color: accent }}>
              Certificate of Completion
            </p>
            <Award size={40} style={{ color: accent }} />
            <p className="text-sm text-slate-500">This certifies that</p>
            <p className="text-3xl font-black text-slate-900">{studentName}</p>
            <p className="text-sm text-slate-500">has successfully completed the module</p>
            <p className="text-xl font-bold" style={{ color: accent }}>
              {moduleName}
            </p>
            <p className="text-xs text-slate-400 mt-4">STEMulate Academy · Keep exploring!</p>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Certificate colour:</span>
            {ACCENTS.map((a) => (
              <button
                key={a.hex}
                onClick={() => setAccent(a.hex)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform",
                  accent === a.hex ? "scale-110 border-slate-800" : "border-white",
                )}
                style={{ backgroundColor: a.hex }}
                aria-label={a.name}
              />
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: accent }}
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
