import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  MessageSquare,
  UserPlus,
  Repeat,
  Gamepad2,
  Send,
  Hash,
  Search,
  X,
  Check,
  MoreVertical,
  ArrowLeft,
  Plus,
  LogOut,
  UserMinus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { MOCK_CARDS, AVATAR_OPTIONS } from "../data/mock";
import { cn } from "./ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  getFriends,
  searchUsers,
  sendFriendRequest,
  answerFriendRequest,
  removeFriend,
  getConversations,
  openDirectChat,
  createGroup,
  addGroupMembers,
  leaveGroup,
  getMessages,
  sendMessage,
  searchMessages,
  type ChatMessage,
  type Conversation,
  type FriendRequest,
  type MessageSearchResult,
  type PublicUser,
  type SearchStatus,
} from "../api/social";
import stembotBlue from "../assets/stembot_blue.png";
import stembotGreen from "../assets/stembot_green.png";

// How often the chat checks for new messages, conversations and requests.
// Polling keeps it live between real accounts without a websocket server.
const MESSAGE_POLL_MS = 2500;
const LIST_POLL_MS = 6000;
const FRIENDS_POLL_MS = 10000;

type ListTab = "chats" | "groups" | "friends";

export function avatarFor(user: { userId: number; avatar: string | null }) {
  return user.avatar || AVATAR_OPTIONS[user.userId % AVATAR_OPTIONS.length];
}

function timeLabel(sqlTime: string) {
  // SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
  const d = new Date(sqlTime.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-pop-2 text-[#1b1b12] rounded-md px-1 border-[1.5px] border-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function FriendsTab({ myUserId }: { myUserId: number }) {
  const [tab, setTab] = useState<ListTab>("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);

  // Search at the top of the chat list
  const [search, setSearch] = useState("");
  const [messageHits, setMessageHits] = useState<MessageSearchResult[]>([]);
  const [jumpToMessage, setJumpToMessage] = useState<number | null>(null);

  const [tradeOpen, setTradeOpen] = useState(false);
  const [groupDialog, setGroupDialog] = useState<"create" | "add" | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    { kind: "leave"; convo: Conversation } | { kind: "unfriend"; user: PublicUser } | null
  >(null);

  const lastMessageId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // ---- Loading & polling ----
  const loadConversations = useCallback(async () => {
    try {
      const { conversations } = await getConversations();
      setConversations(conversations);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const res = await getFriends();
      setFriends(res.friends);
      setIncoming(res.incoming);
      setOutgoing(res.outgoing);
    } catch {
      // Shown via the offline banner from loadConversations.
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadFriends();
    const a = setInterval(loadConversations, LIST_POLL_MS);
    const b = setInterval(loadFriends, FRIENDS_POLL_MS);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [loadConversations, loadFriends]);

  // Messages for the open chat: full load on open, then only newer ones.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    lastMessageId.current = 0;
    setMessages([]);

    const poll = async () => {
      try {
        const { messages: fresh } = await getMessages(activeId, lastMessageId.current);
        if (cancelled || fresh.length === 0) return;
        lastMessageId.current = fresh[fresh.length - 1].id;
        setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
      } catch {
        // Try again next tick.
      }
    };
    poll();
    const t = setInterval(poll, MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeId]);

  // Keep the newest message in view, or jump to a search hit.
  useEffect(() => {
    if (jumpToMessage) {
      const el = document.getElementById(`msg-${jumpToMessage}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => setJumpToMessage(null), 2500);
        return;
      }
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, jumpToMessage]);

  // Server-side message search, debounced.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setMessageHits([]);
      return;
    }
    const t = setTimeout(() => {
      searchMessages(q)
        .then(({ results }) => setMessageHits(results))
        .catch(() => setMessageHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ---- Actions ----
  const send = async () => {
    const body = input.trim();
    if (!body || !activeId) return;
    setInput("");
    try {
      await sendMessage(activeId, body);
      const { messages: fresh } = await getMessages(activeId, lastMessageId.current);
      if (fresh.length) {
        lastMessageId.current = fresh[fresh.length - 1].id;
        setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
      }
      loadConversations();
    } catch (e) {
      setInput(body);
      toast.error((e as Error).message);
    }
  };

  const startChatWith = async (friend: PublicUser) => {
    try {
      const { conversation } = await openDirectChat(friend.userId);
      await loadConversations();
      setTab("chats");
      setActiveId(conversation.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onAnswer = async (req: FriendRequest, action: "accept" | "decline" | "cancel") => {
    try {
      await answerFriendRequest(req.requestId, action);
      if (action === "accept") toast.success(`You and ${req.user.username} are now friends! 🎉`);
      loadFriends();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "leave") {
        await leaveGroup(confirm.convo.id);
        toast.success(`You left ${confirm.convo.name}.`);
        if (activeId === confirm.convo.id) setActiveId(null);
        loadConversations();
      } else {
        await removeFriend(confirm.user.userId);
        toast.success(`${confirm.user.username} was removed from your friends.`);
        loadFriends();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
    setConfirm(null);
  };

  // ---- Derived lists ----
  const q = search.trim().toLowerCase();
  const matchesSearch = (c: Conversation) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.members.some((m) => m.username.toLowerCase().includes(q)) ||
    (c.lastMessage?.body.toLowerCase().includes(q) ?? false);
  const chats = conversations.filter((c) => !c.isGroup && matchesSearch(c));
  const groups = conversations.filter((c) => c.isGroup && matchesSearch(c));
  const shownFriends = friends.filter((f) => !q || f.username.toLowerCase().includes(q));
  const convoName = (id: number) => conversations.find((c) => c.id === id)?.name ?? "Chat";

  const openSearchHit = (hit: MessageSearchResult) => {
    const convo = conversations.find((c) => c.id === hit.conversationId);
    if (convo) setTab(convo.isGroup ? "groups" : "chats");
    setActiveId(hit.conversationId);
    setJumpToMessage(hit.messageId);
  };

  const friendOfOtherMember =
    active && !active.isGroup ? active.members.find((m) => m.userId !== myUserId) : undefined;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4 shrink-0 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="kicker">
            <Users size={13} /> Friends
          </span>
          <h1 className="font-display text-foreground !text-[clamp(1.6rem,1.2rem+1.2vw,2.3rem)] mt-2.5 mb-0.5">Chat with your crew</h1>
          <p className="text-sm font-semibold text-muted-foreground line-clamp-2">
            Chat with friends one-on-one or in groups. Messages arrive live.
          </p>
        </div>
        <img src={stembotBlue} alt="" className="h-20 w-auto shrink-0 die-cut bob rotate-[8deg] hidden sm:block -mb-3 relative z-10" />
      </div>

      {offline && (
        <p className="mb-3 text-xs font-bold text-white bg-destructive border-2 border-ink shadow-[0_3px_0_var(--ink-line)] rounded-2xl px-4 py-2 -rotate-[0.5deg]">
          Can't reach the Academy server right now. Chats will reappear once it's back.
        </p>
      )}

      {/* Fixed-height chat area, the same size on every visit and every chat */}
      <div className="grid grid-cols-1 md:grid-cols-[310px_1fr] sticker overflow-hidden h-[calc(100dvh-17rem)] md:h-[calc(100dvh-14rem)] min-h-[440px] max-h-[760px]">
        {/* ---------------- List panel ---------------- */}
        <div
          className={cn(
            "md:border-r-[2.5px] border-ink flex flex-col min-h-0 bg-soft-1",
            active ? "hidden md:flex" : "flex",
          )}
        >
          {/* Search at the top of chat */}
          <div className="p-3 border-b-[2.5px] border-ink shrink-0 bg-card">
            <div className="relative">
              <Search size={16} strokeWidth={2.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats & messages"
                className="pop-field w-full h-11 pl-10 pr-10 !rounded-full text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="icon-pop icon-pop-sm !w-7 !h-7 !shadow-none absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label="Clear search"
                >
                  <X size={13} strokeWidth={3} />
                </button>
              )}
            </div>

            {/* Chats & groups kept separate */}
            <div className="pop-tabs-list grid grid-cols-3 w-full mt-3 !p-1">
              {(
                [
                  ["chats", "Chats", <MessageSquare size={14} key="i" />],
                  ["groups", "Groups", <Hash size={14} key="i" />],
                  ["friends", "Friends", <Users size={14} key="i" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className="pop-tab relative !px-1 !py-1.5 !text-[13px]"
                >
                  {icon}
                  {label}
                  {id === "friends" && incoming.length > 0 && (
                    <span className="absolute -top-2.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-white border-2 border-ink text-[10px] font-black leading-4 rotate-12 shadow-[0_2px_0_var(--ink-line)]">
                      {incoming.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {q.length >= 2 && messageHits.length > 0 && (
              <div className="mb-3 space-y-2">
                <span className="tag-pop">
                  <Search size={11} strokeWidth={3} /> Messages
                </span>
                {messageHits.map((hit) => (
                  <button
                    key={hit.messageId}
                    onClick={() => openSearchHit(hit)}
                    className="w-full text-left px-3 py-2.5 rounded-2xl bg-card border-2 border-ink shadow-[0_2px_0_var(--ink-line)] hover:-translate-y-0.5 transition-transform"
                  >
                    <p className="text-[11px] font-black text-soft-3-ink truncate">
                      {convoName(hit.conversationId)} · {hit.senderName}
                    </p>
                    <p className="text-xs font-semibold text-foreground line-clamp-2">
                      <Highlight text={hit.body} query={search} />
                    </p>
                  </button>
                ))}
              </div>
            )}

            {tab === "chats" && (
              <>
                {chats.map((c) => (
                  <ConversationRow
                    key={c.id}
                    convo={c}
                    active={c.id === activeId}
                    onClick={() => setActiveId(c.id)}
                    query={search}
                  />
                ))}
                {loaded && chats.length === 0 && (
                  <EmptyHint
                    text={q ? "No chats match your search." : "No chats yet. Pick a friend to start chatting!"}
                    action={!q ? { label: "Find friends", onClick: () => setTab("friends") } : undefined}
                  />
                )}
              </>
            )}

            {tab === "groups" && (
              <>
                <button
                  onClick={() => setGroupDialog("create")}
                  disabled={friends.length === 0}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl border-2 border-dashed border-ink bg-card/60 text-sm font-display font-semibold text-foreground hover:bg-card hover:-rotate-[0.6deg] transition-transform disabled:opacity-50 disabled:hover:rotate-0"
                >
                  <span className="w-10 h-10 rounded-full bg-pop-2 text-[#1b1b12] border-2 border-ink shadow-[0_2px_0_var(--ink-line)] flex items-center justify-center">
                    <Plus size={18} strokeWidth={3} />
                  </span>
                  Create a group chat
                </button>
                {groups.map((c) => (
                  <ConversationRow
                    key={c.id}
                    convo={c}
                    active={c.id === activeId}
                    onClick={() => setActiveId(c.id)}
                    query={search}
                  />
                ))}
                {loaded && groups.length === 0 && (
                  <EmptyHint
                    text={
                      q
                        ? "No groups match your search."
                        : friends.length === 0
                          ? "Add some friends first, then make a group together."
                          : "No groups yet. Create one for your STEM squad!"
                    }
                  />
                )}
              </>
            )}

            {tab === "friends" && (
              <FriendsPanel
                friends={shownFriends}
                incoming={incoming}
                outgoing={outgoing}
                onAnswer={onAnswer}
                onMessage={startChatWith}
                onUnfriend={(user) => setConfirm({ kind: "unfriend", user })}
                onRequestSent={loadFriends}
              />
            )}
          </div>
        </div>

        {/* ---------------- Chat panel ---------------- */}
        <div className={cn("flex flex-col min-h-0 chat-paper", active ? "flex" : "hidden md:flex")}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-4">
              <div className="chat-bubble chat-bubble-them !max-w-xs !rotate-[-2deg] font-display !text-lg !font-semibold !px-5 !py-3">
                Pick a chat to start talking!
              </div>
              <img src={stembotGreen} alt="" className="h-32 w-auto die-cut bob ml-10" />
              <p className="text-sm font-semibold text-muted-foreground max-w-xs">
                Chats with one friend live under <b className="text-foreground">Chats</b>, and group chats live under{" "}
                <b className="text-foreground">Groups</b>.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-hero text-primary-foreground flex items-center justify-between gap-2 px-3 py-2.5 md:px-4 border-b-[2.5px] border-ink shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActiveId(null)}
                    className="md:hidden icon-pop icon-pop-sm"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft size={16} strokeWidth={2.75} />
                  </button>
                  <ConvoAvatar convo={active} size="sm" />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-lg leading-tight truncate">{active.name}</p>
                    {active.isGroup && (
                      <p className="text-[11px] font-bold opacity-80 truncate">
                        {active.members.length} members
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setTradeOpen(true)}
                    className="hidden sm:inline-flex btn-pop btn-pop-sm !text-xs"
                  >
                    <Repeat size={14} strokeWidth={2.5} /> Trade Cards
                  </button>
                  <button
                    onClick={() => toast("Playing games together is coming soon! 🎮")}
                    className="hidden sm:inline-flex btn-pop btn-pop-sm btn-pop2 !text-xs"
                  >
                    <Gamepad2 size={14} strokeWidth={2.5} /> Play Together
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="icon-pop" aria-label="Chat options">
                        <MoreVertical size={17} strokeWidth={2.75} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={() => setMembersOpen(true)}>
                        <Users size={14} /> {active.isGroup ? "View members" : "View profile"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="sm:hidden" onSelect={() => setTradeOpen(true)}>
                        <Repeat size={14} /> Trade cards
                      </DropdownMenuItem>
                      {active.isGroup && (
                        <DropdownMenuItem onSelect={() => setGroupDialog("add")}>
                          <UserPlus size={14} /> Add friends
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {active.isGroup ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setConfirm({ kind: "leave", convo: active })}
                        >
                          <LogOut size={14} /> Leave group
                        </DropdownMenuItem>
                      ) : (
                        friendOfOtherMember && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setConfirm({ kind: "unfriend", user: friendOfOtherMember })}
                          >
                            <UserMinus size={14} /> Remove friend
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 px-5 py-5 space-y-3.5 overflow-y-auto min-h-0">
                {messages.length === 0 && (
                  <div className="flex justify-center py-8">
                    <span className="kicker kicker-3 !text-xs !normal-case !tracking-normal !font-bold border-2 border-ink">
                      Say hello to {active.name}! 👋
                    </span>
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === myUserId;
                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={cn("flex gap-2 items-end", mine ? "justify-end pr-2" : "justify-start pl-2")}
                    >
                      {!mine && active.isGroup && (
                        <img
                          src={avatarFor({ userId: m.senderId ?? 0, avatar: m.senderAvatar })}
                          alt=""
                          className="w-8 h-8 rounded-full bg-soft-3 border-2 border-ink shrink-0 mr-2.5 object-cover"
                        />
                      )}
                      <div
                        className={cn(
                          "chat-bubble",
                          mine ? "chat-bubble-me" : "chat-bubble-them",
                          jumpToMessage === m.id && "chat-bubble-hit",
                        )}
                      >
                        {!mine && active.isGroup && (
                          <p className="font-display text-[11px] font-bold text-soft-3-ink">{m.senderName}</p>
                        )}
                        <p className="whitespace-pre-wrap">
                          <Highlight text={m.body} query={jumpToMessage === m.id ? search : ""} />
                        </p>
                        <p className={cn("text-[9.5px] font-bold mt-0.5 opacity-70", mine && "text-right")}>
                          {timeLabel(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t-[2.5px] border-ink bg-card flex items-center gap-2.5 shrink-0">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  maxLength={500}
                  placeholder={`Message ${active.name}...`}
                  className="pop-field flex-1 min-w-0 h-11 px-4 !rounded-full text-sm"
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="icon-pop !w-11 !h-11 !bg-primary !text-primary-foreground -rotate-6 hover-wiggle"
                  aria-label="Send"
                >
                  <Send size={17} strokeWidth={2.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members / profile */}
      <Dialog open={membersOpen && !!active} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{active?.isGroup ? `${active.name} members` : active?.name}</DialogTitle>
            {active?.isGroup && <DialogDescription>Everyone in this group chat.</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2.5 max-h-72 overflow-y-auto p-1">
            {active?.members.map((m, i) => (
              <div
                key={m.userId}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-2xl bg-soft-1 border-2 border-ink shadow-[0_2px_0_var(--ink-line)]",
                  i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]",
                )}
              >
                <img src={avatarFor(m)} alt="" className="w-10 h-10 rounded-full bg-card border-2 border-ink object-cover" />
                <p className="text-sm font-bold text-foreground flex-1 truncate">
                  {m.username} {m.userId === myUserId && <span className="text-muted-foreground">(you)</span>}
                </p>
                <span className="chip-ink !py-0.5 !px-2 !text-[11px] !shadow-[0_2px_0_var(--ink-line)] bg-pop-2 !text-[#1b1b12]">
                  Lv {m.level}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create group / add to group */}
      <GroupDialog
        mode={groupDialog}
        friends={friends}
        existing={groupDialog === "add" && active ? active.members.map((m) => m.userId) : []}
        onClose={() => setGroupDialog(null)}
        onSubmit={async (name, ids) => {
          try {
            if (groupDialog === "create") {
              const { conversation } = await createGroup(name, ids);
              toast.success(`Group "${conversation.name}" created! 🎉`);
              await loadConversations();
              setTab("groups");
              setActiveId(conversation.id);
            } else if (active) {
              await addGroupMembers(active.id, ids);
              toast.success("Friends added to the group.");
              loadConversations();
            }
            setGroupDialog(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      {/* Are-you-sure for leaving a group / removing a friend */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <span className="w-14 h-14 mx-auto sm:mx-0 rounded-2xl bg-destructive text-white border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center -rotate-6">
              {confirm?.kind === "leave" ? <LogOut size={24} strokeWidth={2.5} /> : <UserMinus size={24} strokeWidth={2.5} />}
            </span>
            <AlertDialogTitle>
              {confirm?.kind === "leave" ? `Leave ${confirm.convo.name}?` : `Remove ${confirm?.kind === "unfriend" ? confirm.user.username : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "leave"
                ? "You won't see new messages from this group unless someone adds you back."
                : "They'll leave your friends list. You can send a new friend request any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doConfirm} className="bg-destructive text-white">
              {confirm?.kind === "leave" ? "Leave group" : "Remove friend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tradeOpen && active && (
        <div className="fixed inset-0 z-50 pop-overlay flex items-center justify-center p-4" onClick={() => setTradeOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="pop-dialog relative max-w-md w-full animate-in fade-in-0 zoom-in-95"
          >
            <button onClick={() => setTradeOpen(false)} className="pop-close" aria-label="Close">
              <X size={16} strokeWidth={3} />
            </button>
            <span className="tag-pop tag-pop-2 mb-2">
              <Repeat size={11} strokeWidth={3} /> Card swap
            </span>
            <h3 className="pop-dialog-title mb-1 pr-10">Trade cards with {active.name}</h3>
            <p className="pop-dialog-desc mb-4">
              Pick a card to offer. (Card trading is a preview and isn't saved yet.)
            </p>
            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto mb-5 p-1.5">
              {MOCK_CARDS.map((c, i) => (
                <div
                  key={c.id}
                  className={cn(
                    "aspect-[3/4] rounded-xl overflow-hidden border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] bg-soft-1 transition-transform hover:-translate-y-1 hover:rotate-0",
                    i % 3 === 0 ? "-rotate-2" : i % 3 === 1 ? "rotate-1" : "rotate-2",
                  )}
                >
                  <img src={c.imageUrl} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <button onClick={() => setTradeOpen(false)} className="btn-pop btn-primary w-full">
              <Repeat size={16} strokeWidth={2.5} /> Send Trade Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ConvoAvatar({ convo, size = "md" }: { convo: Conversation; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-10 h-10" : "w-11 h-11";
  if (convo.isGroup) {
    return (
      <div
        className={cn(
          cls,
          "rounded-2xl bg-pop-3 text-[color:var(--pop-3-ink)] border-[2.5px] border-ink shadow-[0_2px_0_var(--ink-line)] flex items-center justify-center shrink-0 rotate-[-4deg]",
        )}
      >
        <Hash size={size === "sm" ? 17 : 19} strokeWidth={3} />
      </div>
    );
  }
  const other = convo.members.find((m) => m.username === convo.name);
  return (
    <img
      src={other ? avatarFor(other) : AVATAR_OPTIONS[0]}
      alt=""
      className={cn(cls, "rounded-full bg-soft-3 border-[2.5px] border-ink shadow-[0_2px_0_var(--ink-line)] shrink-0 object-cover")}
    />
  );
}

function ConversationRow({
  convo,
  active,
  onClick,
  query,
}: {
  convo: Conversation;
  active: boolean;
  onClick: () => void;
  query: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-2xl text-left border-2 transition-all",
        active
          ? "bg-primary text-primary-foreground border-ink shadow-[0_3px_0_var(--ink-line)] -rotate-[0.8deg]"
          : "bg-card border-ink shadow-[0_2px_0_var(--ink-line)] hover:shadow-[0_4px_0_var(--ink-line)] hover:-translate-y-0.5",
      )}
    >
      <ConvoAvatar convo={convo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold truncate flex-1">
            <Highlight text={convo.name} query={query} />
          </span>
          {convo.lastMessage && (
            <span
              className={cn(
                "text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full",
                active ? "bg-card text-foreground border-[1.5px] border-ink" : "text-muted-foreground",
              )}
            >
              {timeLabel(convo.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p className={cn("text-xs font-semibold truncate", active ? "opacity-85" : "text-muted-foreground")}>
          {convo.lastMessage
            ? `${convo.isGroup && convo.lastMessage.sender ? `${convo.lastMessage.sender}: ` : ""}${convo.lastMessage.body}`
            : convo.isGroup
              ? `${convo.members.length} members`
              : "No messages yet"}
        </p>
      </div>
    </button>
  );
}

function EmptyHint({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="text-center px-4 py-6 flex flex-col items-center">
      <span className="motif-icon w-14 h-14 mb-2 -rotate-12 opacity-90" aria-hidden />
      <p className="text-sm font-semibold text-muted-foreground max-w-[15rem]">{text}</p>
      {action && (
        <button onClick={action.onClick} className="btn-pop btn-pop-sm btn-primary mt-3 rotate-[-2deg]">
          <UserPlus size={14} strokeWidth={2.5} /> {action.label}
        </button>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<SearchStatus, string> = {
  none: "Add",
  friends: "Friends",
  requested: "Sent",
  incoming: "Accept",
};

function FriendsPanel({
  friends,
  incoming,
  outgoing,
  onAnswer,
  onMessage,
  onUnfriend,
  onRequestSent,
}: {
  friends: PublicUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  onAnswer: (req: FriendRequest, action: "accept" | "decline" | "cancel") => void;
  onMessage: (friend: PublicUser) => void;
  onUnfriend: (friend: PublicUser) => void;
  onRequestSent: () => void;
}) {
  const [name, setName] = useState("");
  const [results, setResults] = useState<(PublicUser & { status: SearchStatus })[]>([]);
  const [open, setOpen] = useState(false);

  // Live dropdown of real accounts matching what's typed, so requests only
  // ever go to someone who actually exists.
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(q)
        .then(({ users }) => setResults(users))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [name]);

  const send = async (username: string) => {
    try {
      const res = await sendFriendRequest(username);
      toast.success(
        res.status === "friends"
          ? `You and ${res.user.username} are now friends! 🎉`
          : `Friend request sent to ${res.user.username}!`,
      );
      setName("");
      setResults([]);
      setOpen(false);
      onRequestSent();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exactMatch = useMemo(
    () => results.find((r) => r.username.toLowerCase() === name.trim().toLowerCase()),
    [results, name],
  );

  return (
    <div className="space-y-5 p-0.5">
      <div className="relative bg-card border-2 border-ink rounded-2xl shadow-[0_3px_0_var(--ink-line)] p-3">
        <span className="tag-pop tag-pop-2 mb-2.5">
          <UserPlus size={11} strokeWidth={3} /> Add a friend
        </span>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && send(name.trim())}
            placeholder="Type their username"
            className="pop-field flex-1 min-w-0 h-10 px-3.5 !rounded-full text-sm"
          />
          <button
            onClick={() => name.trim() && send(name.trim())}
            disabled={!exactMatch || exactMatch.status !== "none"}
            className="icon-pop !bg-primary !text-primary-foreground"
            aria-label="Send friend request"
          >
            <UserPlus size={16} strokeWidth={2.5} />
          </button>
        </div>
        {open && name.trim().length >= 2 && (
          <div className="pop-menu absolute z-20 left-2 right-2 mt-2 max-h-60 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground p-3">No Academy account with that username.</p>
            ) : (
              results.map((u) => (
                <div key={u.userId} className="flex items-center gap-2 p-2 rounded-xl hover:bg-soft-1">
                  <img src={avatarFor(u)} alt="" className="w-8 h-8 rounded-full bg-soft-3 border-2 border-ink object-cover" />
                  <span className="text-sm font-bold text-foreground flex-1 truncate">{u.username}</span>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (u.status === "none" || u.status === "incoming") && send(u.username)}
                    disabled={u.status === "friends" || u.status === "requested"}
                    className={cn(
                      "font-display text-[12px] font-semibold px-3 py-1 rounded-full border-2",
                      u.status === "none" || u.status === "incoming"
                        ? "bg-primary text-primary-foreground border-ink shadow-[0_2px_0_var(--ink-line)] hover:-translate-y-px"
                        : "bg-transparent text-muted-foreground border-dashed border-ink/40",
                    )}
                  >
                    {STATUS_LABEL[u.status]}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {incoming.length > 0 && (
        <div className="space-y-2">
          <span className="tag-pop !bg-destructive !text-white">Friend requests ({incoming.length})</span>
          {incoming.map((r) => (
            <div
              key={r.requestId}
              className="flex items-center gap-2 p-2 pl-2.5 rounded-2xl bg-soft-2 border-2 border-ink shadow-[0_3px_0_var(--ink-line)] rotate-[0.6deg]"
            >
              <img src={avatarFor(r.user)} alt="" className="w-9 h-9 rounded-full bg-card border-2 border-ink object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-foreground truncate leading-tight">{r.user.username}</p>
                <p className="text-[10px] font-bold text-soft-2-ink">wants to be friends!</p>
              </div>
              <button
                onClick={() => onAnswer(r, "accept")}
                className="icon-pop icon-pop-sm !bg-pop-2 !text-[#1b1b12]"
                aria-label={`Accept ${r.user.username}`}
              >
                <Check size={15} strokeWidth={3} />
              </button>
              <button
                onClick={() => onAnswer(r, "decline")}
                className="icon-pop icon-pop-sm"
                aria-label={`Decline ${r.user.username}`}
              >
                <X size={15} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <span className="tag-pop">
          <Users size={11} strokeWidth={3} /> Your friends ({friends.length})
        </span>
        {friends.length === 0 && (
          <p className="text-xs font-semibold text-muted-foreground px-1">
            No friends yet. Ask a classmate for their username and add them above!
          </p>
        )}
        {friends.map((f) => (
          <div
            key={f.userId}
            className="flex items-center gap-2.5 p-2 pl-2.5 rounded-2xl bg-card border-2 border-ink shadow-[0_2px_0_var(--ink-line)] hover:-translate-y-0.5 transition-transform"
          >
            <img src={avatarFor(f)} alt="" className="w-9 h-9 rounded-full bg-soft-3 border-2 border-ink object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-foreground truncate leading-tight">{f.username}</p>
              <span className="inline-block mt-0.5 text-[10px] font-black px-1.5 rounded-full bg-soft-1 text-foreground border-[1.5px] border-ink">
                Level {f.level}
              </span>
            </div>
            <button
              onClick={() => onMessage(f)}
              className="icon-pop icon-pop-sm !bg-primary !text-primary-foreground"
              aria-label={`Message ${f.username}`}
            >
              <MessageSquare size={14} strokeWidth={2.5} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="icon-pop icon-pop-sm" aria-label={`Options for ${f.username}`}>
                  <MoreVertical size={14} strokeWidth={2.75} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{f.username}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onMessage(f)}>
                  <MessageSquare size={14} /> Message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onUnfriend(f)}>
                  <UserMinus size={14} /> Remove friend
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {outgoing.length > 0 && (
        <div className="space-y-2">
          <span className="tag-pop tag-pop-1">
            <Clock size={11} strokeWidth={3} /> Waiting for a reply
          </span>
          {outgoing.map((r) => (
            <div
              key={r.requestId}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl border-2 border-dashed border-ink/50 bg-card/50"
            >
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-xs font-bold text-foreground flex-1 truncate">{r.user.username}</span>
              <button
                onClick={() => onAnswer(r, "cancel")}
                className="font-display text-[11px] font-semibold px-2.5 py-0.5 rounded-full border-2 border-ink bg-card hover:bg-destructive hover:text-white"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDialog({
  mode,
  friends,
  existing,
  onClose,
  onSubmit,
}: {
  mode: "create" | "add" | null;
  friends: PublicUser[];
  existing: number[];
  onClose: () => void;
  onSubmit: (name: string, memberIds: number[]) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (mode) {
      setName("");
      setPicked([]);
    }
  }, [mode]);

  const choices = friends.filter((f) => !existing.includes(f.userId));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const canSubmit = picked.length > 0 && (mode === "add" || name.trim().length > 0);

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create a group chat" : "Add friends to the group"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Give your group a name and pick who's in it." : "Pick friends to add."}
          </DialogDescription>
        </DialogHeader>
        {mode === "create" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Group name, e.g. Volcano Squad 🌋"
            className="pop-field w-full h-11 px-4 text-sm"
          />
        )}
        <div className="space-y-2 max-h-60 overflow-y-auto p-1">
          {choices.length === 0 && (
            <p className="text-sm font-semibold text-muted-foreground">All your friends are already in this group.</p>
          )}
          {choices.map((f) => {
            const on = picked.includes(f.userId);
            return (
              <label
                key={f.userId}
                className={cn(
                  "flex items-center gap-3 p-2 pr-3 rounded-2xl cursor-pointer border-2 border-ink transition-all",
                  on
                    ? "bg-soft-1 shadow-[0_3px_0_var(--ink-line)] -rotate-[0.6deg]"
                    : "bg-card shadow-[0_1px_0_var(--ink-line)] hover:-translate-y-0.5",
                )}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(f.userId)} className="sr-only peer" />
                <span
                  data-state={on ? "checked" : "unchecked"}
                  className="pop-check peer-focus-visible:ring-4 peer-focus-visible:ring-ring/45"
                  aria-hidden
                >
                  {on && <Check size={13} strokeWidth={3.5} />}
                </span>
                <img src={avatarFor(f)} alt="" className="w-9 h-9 rounded-full bg-soft-3 border-2 border-ink object-cover" />
                <span className="font-display font-semibold text-foreground">{f.username}</span>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="btn-pop btn-pop-sm">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(name.trim(), picked)}
            disabled={!canSubmit}
            className="btn-pop btn-pop-sm btn-primary"
          >
            {mode === "create" ? `Create group${picked.length ? ` (${picked.length + 1})` : ""}` : "Add"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
