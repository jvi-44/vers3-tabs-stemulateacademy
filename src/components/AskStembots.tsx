import { useState } from "react";
import { MessageCircleQuestion, Send } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import type { LessonBeat } from "../data/lessonContent";

type ChatMsg = { from: "me" | "bot"; botKey?: string; text: string };

// A lightweight, rule-based responder (no external AI call in this build) —
// picks a relevant STEMbot and gives a short, on-topic reply using the
// current beat's title/description as context. Swap this out for a real
// model call later without changing the UI below.
function respond(question: string, beat: LessonBeat): ChatMsg {
  const q = question.toLowerCase();
  let botKey = beat.subject === "science" ? "sophia" : beat.subject === "math" ? "matthew" : "timothy";
  if (q.includes("game") || q.includes("build") || q.includes("play")) botKey = "emily";
  if (q.includes("code") || q.includes("tech")) botKey = "timothy";

  let text = "";
  if (q.includes("point") || q.includes("xp") || q.includes("atom")) {
    text = `Good question! This one is called "${beat.title}" — finishing it earns you points toward your level, plus Atoms you can spend on card packs.`;
  } else if (q.includes("hard") || q.includes("difficult") || q.includes("stuck")) {
    text = `Take it step by step — re-read "${beat.description.slice(0, 80)}${beat.description.length > 80 ? "…" : ""}" once more, and it'll click. You've got this!`;
  } else if (q.includes("what") || q.includes("about")) {
    text = `"${beat.title}" is all about: ${beat.description}`;
  } else {
    text = `Great question about "${beat.title}"! ${beat.description}`;
  }
  return { from: "bot", botKey, text };
}

export function AskStembots({ beat }: { beat: LessonBeat }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const send = () => {
    if (!input.trim()) return;
    const mine: ChatMsg = { from: "me", text: input.trim() };
    const reply = respond(input.trim(), beat);
    setMessages((m) => [...m, mine, reply]);
    setInput("");
  };

  return (
    <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-4 font-bold text-sm text-foreground"
      >
        <MessageCircleQuestion size={18} className="text-primary" />
        Ask about this lesson
        <span className="ml-auto text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Ask any of the STEMbots a question about what's on your screen right now.
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {messages.map((m, i) =>
              m.from === "me" ? (
                <div key={i} className="flex justify-end">
                  <p className="bg-primary text-primary-foreground text-sm px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white border border-border shrink-0">
                    <img src={STEMBOTS[m.botKey!].avatar} alt="" className="w-full h-full object-contain p-0.5" />
                  </div>
                  <p className="bg-muted text-foreground text-sm px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                    <span className="font-bold">{STEMBOTS[m.botKey!].name}: </span>
                    {m.text}
                  </p>
                </div>
              ),
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a question..."
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={send} className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
