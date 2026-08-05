import { useState } from "react";
import { Users, MessageSquare, UserPlus, Repeat, Gamepad2, Send, Hash } from "lucide-react";
import { MOCK_LEADERBOARD, MOCK_CARDS } from "../data/mock";
import { cn } from "./ui/utils";

type ChatMsg = { from: "me" | "them"; text: string };
type Conversation = {
  id: string;
  name: string;
  avatar: string;
  isGroup: boolean;
  messages: ChatMsg[];
};

const SEED_FRIENDS = MOCK_LEADERBOARD.slice(0, 5).filter((e) => e.username !== "StemExplorer");

export function FriendsTab({ myAtoms }: { myAtoms: number }) {
  const [friends] = useState(SEED_FRIENDS.slice(0, 3));
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    {
      id: "group-1",
      name: "STEM Squad",
      avatar: "",
      isGroup: true,
      messages: [{ from: "them", text: "Anyone up for Space Busters later? 🚀" }],
    },
    ...SEED_FRIENDS.slice(0, 3).map((f) => ({
      id: f.id,
      name: f.username,
      avatar: f.avatar,
      isGroup: false,
      messages: [{ from: "them" as const, text: "Hey! How's the Minecraft module going?" }],
    })),
  ]);
  const [activeConvo, setActiveConvo] = useState<string>("group-1");
  const [input, setInput] = useState("");
  const [tradeOpen, setTradeOpen] = useState(false);

  const active = conversations.find((c) => c.id === activeConvo)!;

  const send = () => {
    if (!input.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvo ? { ...c, messages: [...c.messages, { from: "me", text: input.trim() }] } : c)),
    );
    setInput("");
  };

  const sendRequest = () => {
    if (!addName.trim()) return;
    setPendingRequests((p) => [...p, addName.trim()]);
    setAddName("");
  };

  return (
    <div className="max-w-6xl mx-auto h-full">
      <div className="mb-4">
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <Users className="text-primary" /> Friends
        </h2>
        <p className="text-sm text-muted-foreground">
          Chat one-on-one or in groups, trade cards, and challenge friends to games. (This is a local
          preview of the social features — connecting it to a live multiplayer service is the next step.)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 bg-card border border-border rounded-3xl shadow-sm overflow-hidden" style={{ minHeight: 480 }}>
        {/* Conversation list */}
        <div className="border-b md:border-b-0 md:border-r border-border p-3 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 mb-1">Chats</p>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConvo(c.id)}
              className={cn(
                "w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-left transition-all",
                activeConvo === c.id ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              {c.isGroup ? (
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Hash size={16} />
                </div>
              ) : (
                <img src={c.avatar} className="w-9 h-9 rounded-full bg-muted shrink-0" />
              )}
              <span className="text-sm font-bold text-foreground truncate">{c.name}</span>
            </button>
          ))}

          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 mt-4 mb-1">
            Friends ({friends.length})
          </p>
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 p-2.5">
              <img src={f.avatar} className="w-7 h-7 rounded-full bg-muted shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">{f.username}</span>
            </div>
          ))}

          <div className="p-2 mt-2 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Add by username"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs outline-none"
              />
              <button onClick={sendRequest} className="p-1.5 rounded-xl bg-primary text-primary-foreground shrink-0">
                <UserPlus size={14} />
              </button>
            </div>
            {pendingRequests.length > 0 && (
              <p className="text-[10px] text-muted-foreground px-1">
                Requests sent: {pendingRequests.join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Active chat */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {active.isGroup ? <Hash size={16} className="text-primary" /> : <MessageSquare size={16} className="text-primary" />}
              <span className="font-bold text-foreground">{active.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTradeOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-accent text-accent-foreground"
              >
                <Repeat size={13} /> Trade Cards
              </button>
              <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground">
                <Gamepad2 size={13} /> Play Together
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {active.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "text-sm px-3 py-2 rounded-2xl max-w-[75%]",
                    m.from === "me"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Message ${active.name}...`}
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={send} className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {tradeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setTradeOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl">
            <h3 className="font-black text-foreground mb-1">Trade cards with {active.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">Pick a card to offer — they'll get a matching trade request.</p>
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto mb-4">
              {MOCK_CARDS.map((c) => (
                <div key={c.id} className="aspect-[3/4] rounded-xl overflow-hidden border border-border">
                  <img src={c.imageUrl} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <button
              onClick={() => setTradeOpen(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Send Trade Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
