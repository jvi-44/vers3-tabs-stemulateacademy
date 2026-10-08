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
      <mark className="bg-primary/30 text-inherit rounded px-0.5">{text.slice(i, i + q.length)}</mark>
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
        <p className="mb-3 text-xs font-bold text-destructive bg-destructive/10 rounded-2xl px-4 py-2">
          Can't reach the Academy server right now. Chats will reappear once it's back.
        </p>
      )}

      {/* Fixed-height chat area, the same size on every visit and every chat */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] sticker overflow-hidden h-[calc(100dvh-17rem)] md:h-[calc(100dvh-14rem)] min-h-[440px] max-h-[760px]">
        {/* ---------------- List panel ---------------- */}
        <div
          className={cn(
            "border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0",
            active ? "hidden md:flex" : "flex",
          )}
        >
          {/* Search at the top of chat */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats & messages"
                className="w-full pl-9 pr-8 py-2 rounded-2xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Chats & groups kept separate */}
            <div className="grid grid-cols-3 gap-1 mt-3 bg-accent/50 p-1 rounded-2xl">
              {(
                [
                  ["chats", "Chats", <MessageSquare size={13} key="i" />],
                  ["groups", "Groups", <Hash size={13} key="i" />],
                  ["friends", "Friends", <Users size={13} key="i" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1 text-xs font-bold py-1.5 rounded-xl transition-all",
                    tab === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {icon}
                  {label}
                  {id === "friends" && incoming.length > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[9px] leading-4">
                      {incoming.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {q.length >= 2 && messageHits.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 mb-1">
                  Messages
                </p>
                {messageHits.map((hit) => (
                  <button
                    key={hit.messageId}
                    onClick={() => openSearchHit(hit)}
                    className="w-full text-left p-2.5 rounded-2xl hover:bg-accent/60"
                  >
                    <p className="text-[11px] font-bold text-primary truncate">
                      {convoName(hit.conversationId)} · {hit.senderName}
                    </p>
                    <p className="text-xs text-foreground line-clamp-2">
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
                  className="w-full flex items-center gap-2 p-2.5 rounded-2xl text-sm font-bold text-primary hover:bg-accent/60 disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center">
                    <Plus size={16} />
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
        <div className={cn("flex flex-col min-h-0", active ? "flex" : "hidden md:flex")}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
              <img src={stembotGreen} alt="" className="h-28 w-auto drop-shadow-md" />
              <p className="font-black text-foreground">Pick a chat to start talking!</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Chats with one friend live under Chats, and group chats live under Groups.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 p-3 md:p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setActiveId(null)}
                    className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-accent"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <ConvoAvatar convo={active} size="sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{active.name}</p>
                    {active.isGroup && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {active.members.length} members
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setTradeOpen(true)}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-accent text-accent-foreground"
                  >
                    <Repeat size={13} /> Trade Cards
                  </button>
                  <button
                    onClick={() => toast("Playing games together is coming soon! 🎮")}
                    className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground"
                  >
                    <Gamepad2 size={13} /> Play Together
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-xl hover:bg-accent" aria-label="Chat options">
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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

              <div ref={scrollRef} className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Say hello to {active.name}! 👋
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === myUserId;
                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={cn("flex gap-2 items-end", mine ? "justify-end" : "justify-start")}
                    >
                      {!mine && active.isGroup && (
                        <img
                          src={avatarFor({ userId: m.senderId ?? 0, avatar: m.senderAvatar })}
                          alt=""
                          className="w-6 h-6 rounded-full bg-muted shrink-0"
                        />
                      )}
                      <div
                        className={cn(
                          "text-sm px-3 py-2 rounded-2xl max-w-[75%] transition-shadow",
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                          jumpToMessage === m.id && "ring-4 ring-primary/40",
                        )}
                      >
                        {!mine && active.isGroup && (
                          <p className="text-[10px] font-black opacity-70">{m.senderName}</p>
                        )}
                        <p className="whitespace-pre-wrap">
                          <Highlight text={m.body} query={jumpToMessage === m.id ? search : ""} />
                        </p>
                        <p className={cn("text-[9px] mt-0.5", mine ? "opacity-70 text-right" : "opacity-60")}>
                          {timeLabel(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2 shrink-0">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  maxLength={500}
                  placeholder={`Message ${active.name}...`}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0 disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send size={15} />
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
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {active?.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 p-2 rounded-2xl bg-accent/40">
                <img src={avatarFor(m)} alt="" className="w-9 h-9 rounded-full bg-muted" />
                <p className="text-sm font-bold text-foreground flex-1 truncate">
                  {m.username} {m.userId === myUserId && <span className="text-muted-foreground">(you)</span>}
                </p>
                <span className="text-[10px] font-black text-primary">Lv {m.level}</span>
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
        <AlertDialogContent>
          <AlertDialogHeader>
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
            <AlertDialogAction onClick={doConfirm} className="bg-destructive text-white hover:bg-destructive/90">
              {confirm?.kind === "leave" ? "Leave group" : "Remove friend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tradeOpen && active && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setTradeOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl">
            <h3 className="font-black text-foreground mb-1">Trade cards with {active.name}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pick a card to offer. (Card trading is a preview and isn't saved yet.)
            </p>
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

// ---------------------------------------------------------------------------

function ConvoAvatar({ convo, size = "md" }: { convo: Conversation; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  if (convo.isGroup) {
    return (
      <div className={cn(cls, "rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0")}>
        <Hash size={size === "sm" ? 14 : 16} />
      </div>
    );
  }
  const other = convo.members.find((m) => m.username === convo.name);
  return (
    <img
      src={other ? avatarFor(other) : AVATAR_OPTIONS[0]}
      alt=""
      className={cn(cls, "rounded-full bg-muted shrink-0 object-cover")}
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
        "w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-left transition-all",
        active ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <ConvoAvatar convo={convo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground truncate flex-1">
            <Highlight text={convo.name} query={query} />
          </span>
          {convo.lastMessage && (
            <span className="text-[10px] text-muted-foreground shrink-0">{timeLabel(convo.lastMessage.createdAt)}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
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
    <div className="text-center px-4 py-6">
      <p className="text-xs text-muted-foreground">{text}</p>
      {action && (
        <button onClick={action.onClick} className="mt-2 text-xs font-bold text-primary hover:underline">
          {action.label}
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
    <div className="space-y-4 p-1">
      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
          Add a friend
        </p>
        <div className="flex items-center gap-1.5">
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
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => name.trim() && send(name.trim())}
            disabled={!exactMatch || exactMatch.status !== "none"}
            className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0 disabled:opacity-40"
            aria-label="Send friend request"
          >
            <UserPlus size={15} />
          </button>
        </div>
        {open && name.trim().length >= 2 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-2xl shadow-lg p-1 max-h-60 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No Academy account with that username.</p>
            ) : (
              results.map((u) => (
                <div key={u.userId} className="flex items-center gap-2 p-2 rounded-xl hover:bg-accent/60">
                  <img src={avatarFor(u)} alt="" className="w-7 h-7 rounded-full bg-muted" />
                  <span className="text-sm font-semibold text-foreground flex-1 truncate">{u.username}</span>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (u.status === "none" || u.status === "incoming") && send(u.username)}
                    disabled={u.status === "friends" || u.status === "requested"}
                    className={cn(
                      "text-[11px] font-bold px-2.5 py-1 rounded-lg",
                      u.status === "none" || u.status === "incoming"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-muted-foreground",
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
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1 mb-1">
            Friend requests ({incoming.length})
          </p>
          {incoming.map((r) => (
            <div key={r.requestId} className="flex items-center gap-2 p-2 rounded-2xl bg-primary/10">
              <img src={avatarFor(r.user)} alt="" className="w-8 h-8 rounded-full bg-muted" />
              <span className="text-sm font-bold text-foreground flex-1 truncate">{r.user.username}</span>
              <button
                onClick={() => onAnswer(r, "accept")}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground"
                aria-label={`Accept ${r.user.username}`}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => onAnswer(r, "decline")}
                className="p-1.5 rounded-lg bg-accent text-muted-foreground"
                aria-label={`Decline ${r.user.username}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1 mb-1">
          Your friends ({friends.length})
        </p>
        {friends.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">
            No friends yet. Ask a classmate for their username and add them above!
          </p>
        )}
        {friends.map((f) => (
          <div key={f.userId} className="flex items-center gap-2 p-2 rounded-2xl hover:bg-accent/50">
            <img src={avatarFor(f)} alt="" className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{f.username}</p>
              <p className="text-[10px] text-muted-foreground">Level {f.level}</p>
            </div>
            <button
              onClick={() => onMessage(f)}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10"
              aria-label={`Message ${f.username}`}
            >
              <MessageSquare size={15} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-accent" aria-label={`Options for ${f.username}`}>
                  <MoreVertical size={14} />
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
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1 mb-1">
            Waiting for a reply
          </p>
          {outgoing.map((r) => (
            <div key={r.requestId} className="flex items-center gap-2 p-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground flex-1 truncate">{r.user.username}</span>
              <button
                onClick={() => onAnswer(r, "cancel")}
                className="text-[11px] font-bold text-muted-foreground hover:text-destructive"
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
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {choices.length === 0 && (
            <p className="text-sm text-muted-foreground">All your friends are already in this group.</p>
          )}
          {choices.map((f) => (
            <label
              key={f.userId}
              className={cn(
                "flex items-center gap-3 p-2 rounded-2xl cursor-pointer",
                picked.includes(f.userId) ? "bg-primary/10" : "hover:bg-accent/50",
              )}
            >
              <input
                type="checkbox"
                checked={picked.includes(f.userId)}
                onChange={() => toggle(f.userId)}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              <img src={avatarFor(f)} alt="" className="w-8 h-8 rounded-full bg-muted" />
              <span className="text-sm font-bold text-foreground">{f.username}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(name.trim(), picked)}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50"
          >
            {mode === "create" ? `Create group${picked.length ? ` (${picked.length + 1})` : ""}` : "Add"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
