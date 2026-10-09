#!/usr/bin/env node
// Simulates two players so you can test friends and live chat on your own.
//
//   npm run simulate                       two bots befriend each other and chat
//   npm run simulate -- --with your_name   the bots also friend-request you, then
//                                          chat with you live in a DM and a group
//   npm run simulate -- --minutes 10       keep chatting for 10 minutes (default 3)
//
// Needs the API running (npm run server, or npm run dev:all). The bots are real
// accounts: sign in as either one (PIN 1111) in a second browser window to watch
// from their side. Run with --cleanup to delete every bot account it created.

const API = process.env.API_URL || "http://localhost:4000/api";
const PIN = "1111";
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : undefined;
};
const withUser = flag("with");
const minutes = Number(flag("minutes")) || 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `token` is the bot's session cookie ("stem_session=..."), returned as
// `token` by /signup and /login.
async function call(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Cookie: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error || res.status}`);
  const cookie = res.headers.getSetCookie?.().find((c) => c.startsWith("stem_session="));
  return cookie ? { ...data, token: cookie.split(";")[0] } : data;
}

async function makeBot(name) {
  const ref = await call("/reference-data");
  const username = `${name}_${Math.floor(1000 + Math.random() * 9000)}`;
  const { user, token } = await call("/signup", {
    method: "POST",
    body: {
      fullName: `Test ${name[0].toUpperCase()}${name.slice(1)}`,
      username,
      pin: PIN,
      schoolLevelId: ref.schoolLevels[3].id,
      orgId: ref.organisations[0].id,
      recoveryColourId: ref.recoveryColours[0].id,
      recoverySubjectId: ref.recoverySubjects[0].id,
      consent: true,
    },
  });
  return { ...user, token, say: (convoId, text) => say({ username, token }, convoId, text) };
}

async function say(bot, convoId, text) {
  await call(`/conversations/${convoId}/messages`, { token: bot.token, method: "POST", body: { body: text } });
  console.log(`  ${bot.username}: ${text}`);
}

async function befriend(a, b) {
  await call("/friends/requests", { token: a.token, method: "POST", body: { username: b.username } });
  const { incoming } = await call("/friends", { token: b.token });
  const req = incoming.find((r) => r.user.userId === a.userId);
  await call(`/friends/requests/${req.requestId}/accept`, { token: b.token, method: "POST" });
}

const REPLIES = [
  "Ooh, tell me more! 🤔",
  "That's so cool! Did you finish the water cycle quiz?",
  "I just got 80 XP from the Space Busters game 🚀",
  "Haha nice one!",
  "Which biome is your favourite? Mine is the jungle 🌴",
  "Want to trade cards later?",
];

async function cleanup() {
  // Bots created by this script all use PIN 1111 and a name_#### username.
  const names = args.filter((a) => !a.startsWith("--"));
  if (!names.length) console.log("Pass the bot usernames to delete, e.g. --cleanup sophia_1234 timothy_5678");
  for (const username of names) {
    try {
      const { token } = await call("/login", { method: "POST", body: { username, pin: PIN } });
      await call("/me", { token, method: "DELETE", body: { pin: PIN } });
      console.log(`Deleted ${username}`);
    } catch (e) {
      console.log(`Couldn't delete ${username}: ${e.message}`);
    }
  }
}

async function main() {
  if (flag("cleanup")) return cleanup();

  console.log(`Creating two test players on ${API} ...`);
  const sophia = await makeBot("sophia");
  const timothy = await makeBot("timothy");
  console.log(`  ${sophia.username} and ${timothy.username} (PIN ${PIN})`);

  await befriend(sophia, timothy);
  console.log("They are now friends.");

  const { conversation: dm } = await call("/conversations", {
    token: sophia.token,
    method: "POST",
    body: { isGroup: false, memberIds: [timothy.userId] },
  });
  console.log("\nDirect chat:");
  await sophia.say(dm.id, "Hi Timothy! Ready for the Minecraft lesson? ⛏️");
  await sleep(800);
  await timothy.say(dm.id, "Yes! I'm building a volcano biome 🌋");

  // Check the other side actually received it, i.e. the live chat works.
  const { messages } = await call(`/conversations/${dm.id}/messages`, { token: timothy.token });
  if (messages.length !== 2) throw new Error(`Expected 2 messages, Timothy sees ${messages.length}`);
  const { results } = await call(`/messages/search?q=volcano`, { token: sophia.token });
  if (!results.length) throw new Error("Message search didn't find 'volcano'");
  console.log("  ✓ both players see both messages, and search finds them");

  let realUser = null;
  if (withUser) {
    console.log(`\nSending friend requests to ${withUser} ...`);
    for (const bot of [sophia, timothy]) {
      const res = await call("/friends/requests", { token: bot.token, method: "POST", body: { username: withUser } });
      realUser = res.user;
    }
    console.log(`  Open Friends > Friends as ${withUser} and accept both requests.`);
  }

  const memberIds = [timothy.userId];
  const { conversation: group } = await call("/conversations", {
    token: sophia.token,
    method: "POST",
    body: { isGroup: true, name: "Sim Squad 🤖", memberIds },
  });
  console.log("\nGroup chat 'Sim Squad':");
  await sophia.say(group.id, "Welcome to the squad!");

  // Chat for a while. If a real user joined, answer whatever they write.
  const until = Date.now() + minutes * 60 * 1000;
  const lastSeen = {};
  let invited = false;
  let realDm = null;
  console.log(`\nChatting for ${minutes} minute(s). Press Ctrl+C to stop.`);
  while (Date.now() < until) {
    if (realUser && !invited) {
      const { friends } = await call("/friends", { token: sophia.token });
      const timFriends = (await call("/friends", { token: timothy.token })).friends;
      if (friends.some((f) => f.userId === realUser.userId) && timFriends.some((f) => f.userId === realUser.userId)) {
        await call(`/conversations/${group.id}/members`, {
          token: sophia.token,
          method: "POST",
          body: { memberIds: [realUser.userId] },
        });
        realDm = (
          await call("/conversations", {
            token: timothy.token,
            method: "POST",
            body: { isGroup: false, memberIds: [realUser.userId] },
          })
        ).conversation;
        await timothy.say(realDm.id, `Hi ${realUser.username}! Thanks for accepting 😄`);
        await sophia.say(group.id, `${realUser.username} joined the squad! 🎉`);
        invited = true;
      }
    }

    // Reply when the real user (or the other bot) posts something new.
    for (const [bot, convo] of [
      [timothy, realDm],
      [sophia, group],
    ]) {
      if (!convo) continue;
      const { messages } = await call(`/conversations/${convo.id}/messages?after=${lastSeen[convo.id] || 0}`, {
        token: bot.token,
      });
      if (messages.length) lastSeen[convo.id] = messages[messages.length - 1].id;
      const fromOthers = messages.filter((m) => m.senderId !== sophia.userId && m.senderId !== timothy.userId);
      if (fromOthers.length) {
        await sleep(1200);
        await bot.say(convo.id, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
      }
    }

    if (!realUser && Math.random() < 0.25) {
      const speaker = Math.random() < 0.5 ? sophia : timothy;
      await speaker.say(group.id, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
    }
    await sleep(3000);
  }

  console.log(`\nDone. Remove the bots with: npm run simulate -- --cleanup ${sophia.username} ${timothy.username}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
