import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, Send, X, ChevronRight } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import type { LessonBeat } from "../data/lessonContent";

type ChatMsg = { from: "me" | "bot"; botKey?: string; text: string };

const BOT_FOR_BEAT = (beat: LessonBeat) =>
  beat.subject === "science" ? "sophia" : beat.subject === "math" ? "matthew" : "timothy";

const SYSTEM_CONTEXT = `You are a helpful STEM tutor embedded inside the STEMulate Academy app. Students are aged 7–12. They are working through the STEM x Minecraft lesson called "Minecraft Masterminds" which covers:
- Science: Cycles in Matter (states of matter: solid, liquid, gas; phase changes: melting, freezing, evaporation, condensation)
- Science: The Water Cycle (evaporation, condensation, precipitation, collection) and Minecraft biomes
- Math: Area (length × width) and Volume (length × width × height) using Minecraft blocks
The four STEMbot characters are Sophia (Science), Timothy (Technology), Emily (Engineering), and Matthew (Mathematics).
Keep answers short (2–4 sentences), encouraging, age-appropriate, and use Minecraft examples where possible. Do NOT mention that you are an AI — respond as whichever STEMbot is most relevant.`;

async function callGemini(messages: ChatMsg[], beat: LessonBeat): Promise<{ botKey: string; text: string }> {
  const botKey = BOT_FOR_BEAT(beat);
  const bot = STEMBOTS[botKey];

  const geminiMessages = messages.map((m) => ({
    role: m.from === "me" ? "user" : "model",
    parts: [{ text: m.from === "bot" ? `${STEMBOTS[m.botKey ?? botKey]?.name ?? bot.name}: ${m.text}` : m.text }],
  }));

  const beatContext = `The student is currently on the beat: "${beat.title}" — ${beat.description}`;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemContext: SYSTEM_CONTEXT,
        beatContext,
        botName: bot.name,
        messages: geminiMessages,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return { botKey, text: data.reply ?? "Great question! Keep exploring and things will click." };
  } catch {
    return {
      botKey,
      text: `Great question about "${beat.title}"! ${beat.description.slice(0, 100)}... Keep exploring!`,
    };
  }
}

export function AskStembots({
  beat,
  open,
  onToggle,
}: {
  beat: LessonBeat;
  open: boolean;
  onToggle: () => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const mine: ChatMsg = { from: "me", text };
    setMessages((m) => [...m, mine]);
    setLoading(true);
    const reply = await callGemini([...messages, mine], beat);
    setMessages((m) => [...m, { from: "bot", ...reply }]);
    setLoading(false);
  };

  const botKey = BOT_FOR_BEAT(beat);
  const bot = STEMBOTS[botKey];

  return (
    <>
      {/* Floating toggle tab — visible when panel is closed */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="tab"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            onClick={onToggle}
            className="fixed right-0 bottom-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-40 flex flex-col items-center gap-2 bg-pop-3 text-[color:var(--pop-3-ink)] pl-2 pr-1.5 py-2 md:pl-2.5 md:pr-2 md:py-4 rounded-l-[1.4rem] border-[2.5px] border-r-0 border-ink shadow-[-4px_4px_0_var(--ink-line)] hover:pr-3 transition-all"
          >
            <span className="w-9 h-9 rounded-full bg-card border-2 border-ink overflow-hidden">
              <img src={bot.avatar} alt="" className="w-full h-full object-contain" />
            </span>
            <span className="hidden md:inline font-display font-semibold text-[13px] tracking-wide [writing-mode:vertical-rl] rotate-180">Ask a STEMbot</span>
            <ChevronRight size={14} className="hidden md:block" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Right-side drawer panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="shrink-0 bg-card border-l-[2.5px] border-ink h-screen fixed md:sticky right-0 top-0 flex flex-col overflow-hidden z-50 md:z-30 max-w-[100vw]"
            style={{ minWidth: 0 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b-[2.5px] border-ink shrink-0 bg-pop-3 text-[color:var(--pop-3-ink)]">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-white border-2 border-ink shrink-0">
                <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-lg leading-none">Ask {bot.name}</p>
                <p className="text-[11px] font-bold opacity-85 mt-1 truncate">Stuck? Ask anything about this lesson.</p>
              </div>
              <button onClick={onToggle} className="shrink-0 w-9 h-9 rounded-full bg-card text-[color:var(--card-foreground)] border-2 border-ink flex items-center justify-center" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-playful">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <img src={bot.avatar} alt={bot.name} className="h-28 mx-auto die-cut bob" />
                  <p className="font-display font-bold text-lg text-foreground">{bot.name} is here to help!</p>
                  <p className="text-xs text-muted-foreground px-2">
                    Ask me anything about this lesson. I'll give you a STEM-powered answer!
                  </p>
                  <div className="space-y-1.5 mt-3">
                    {["What is this lesson about?", "I'm stuck — can you help?", "Give me a Minecraft example!"].map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full text-left text-sm bg-card border-2 border-ink shadow-[0_3px_0_var(--ink-line)] hover:-translate-y-0.5 px-3.5 py-2.5 rounded-2xl font-bold transition-transform"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) =>
                m.from === "me" ? (
                  <div key={i} className="flex justify-end">
                    <p className="bg-primary text-primary-foreground text-sm font-semibold px-3.5 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] leading-relaxed border-2 border-ink shadow-[0_3px_0_var(--ink-line)]">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white border-2 border-ink shrink-0">
                      <img src={STEMBOTS[m.botKey!]?.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                    </div>
                    <div className="bg-card text-foreground text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%] leading-relaxed border-2 border-ink shadow-[0_3px_0_var(--ink-line)]">
                      <span className="font-black text-primary">{STEMBOTS[m.botKey!]?.name}: </span>
                      {m.text}
                    </div>
                  </div>
                ),
              )}

              {loading && (
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-white border-2 border-ink shrink-0">
                    <img src={bot.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                  </div>
                  <div className="bg-card px-3.5 py-3 rounded-2xl rounded-bl-sm border-2 border-ink">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t-[2.5px] border-ink shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-2.5 rounded-full border-2 border-ink bg-input-background text-sm font-semibold outline-none focus:ring-4 focus:ring-primary/30"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="w-11 h-11 rounded-full bg-primary text-primary-foreground border-2 border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center shrink-0 disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
