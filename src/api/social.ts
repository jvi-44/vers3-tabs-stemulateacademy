// Friends, friend requests and chats. Every call needs the session cookie
// (sent automatically by request()). Routes live in server/routes/social.js.
import { request } from "./client";

export interface PublicUser {
  userId: number;
  username: string;
  avatar: string | null;
  level: number;
}

export interface FriendRequest {
  requestId: number;
  createdAt: string;
  user: PublicUser;
}

export interface Conversation {
  id: number;
  isGroup: boolean;
  name: string;
  avatar: string | null;
  createdBy: number | null;
  members: PublicUser[];
  lastMessage: { id: number; body: string; createdAt: string; sender: string | null } | null;
}

export interface ChatMessage {
  id: number;
  body: string;
  createdAt: string;
  senderId: number | null;
  senderName: string;
  senderAvatar: string | null;
}

export interface MessageSearchResult {
  messageId: number;
  conversationId: number;
  body: string;
  createdAt: string;
  senderName: string;
}

export type SearchStatus = "none" | "friends" | "requested" | "incoming";

export const searchUsers = (q: string) =>
  request<{ users: (PublicUser & { status: SearchStatus })[] }>(`/users/search?q=${encodeURIComponent(q)}`);

export const getFriends = () =>
  request<{ friends: PublicUser[]; incoming: FriendRequest[]; outgoing: FriendRequest[] }>("/friends");

export const sendFriendRequest = (username: string) =>
  request<{ status: "requested" | "friends"; user: PublicUser }>("/friends/requests", {
    method: "POST",
    body: JSON.stringify({ username }),
  });

export const answerFriendRequest = (requestId: number, action: "accept" | "decline" | "cancel") =>
  request(`/friends/requests/${requestId}/${action}`, { method: "POST" });

export const removeFriend = (userId: number) => request(`/friends/${userId}`, { method: "DELETE" });

export const getConversations = () => request<{ conversations: Conversation[] }>("/conversations");

export const openDirectChat = (friendId: number) =>
  request<{ conversation: Conversation }>("/conversations", {
    method: "POST",
    body: JSON.stringify({ isGroup: false, memberIds: [friendId] }),
  });

export const createGroup = (name: string, memberIds: number[]) =>
  request<{ conversation: Conversation }>("/conversations", {
    method: "POST",
    body: JSON.stringify({ isGroup: true, name, memberIds }),
  });

export const addGroupMembers = (conversationId: number, memberIds: number[]) =>
  request<{ conversation: Conversation }>(`/conversations/${conversationId}/members`, {
    method: "POST",
    body: JSON.stringify({ memberIds }),
  });

export const leaveGroup = (conversationId: number) =>
  request(`/conversations/${conversationId}/leave`, { method: "POST" });

export const getMessages = (conversationId: number, after = 0) =>
  request<{ messages: ChatMessage[] }>(`/conversations/${conversationId}/messages?after=${after}`);

export const sendMessage = (conversationId: number, body: string) =>
  request<{ message: { id: number } }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

export const searchMessages = (q: string) =>
  request<{ results: MessageSearchResult[] }>(`/messages/search?q=${encodeURIComponent(q)}`);

export const getLeaderboard = () =>
  request<{ entries: (PublicUser & { xp: number; isFriend: boolean })[] }>("/leaderboard");
