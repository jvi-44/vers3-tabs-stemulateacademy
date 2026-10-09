// Joins a live game room with pretend players, for testing multiplayer alone.
//
//   1. Start the app (npm run dev:all), open Games, press Live on a game.
//   2. In another terminal: npm run simulate:game -- ABCD 2
//      (ABCD = the room code on screen, 2 = how many pretend players, 1-3)
//
// The pretend players join, press Ready, and when you start the match they
// "play": their scores climb on your live scoreboard and they finish after
// about a minute. Set API=http://host:port if the server isn't on :4000.
//
// Live rooms need a signed-in student, so each pretend player is a throwaway
// account (PIN 1111). They are deleted again when you press Ctrl+C.

const API = process.env.API || "http://localhost:4000";
const [code, countArg] = process.argv.slice(2);
if (!code) {
  console.log("Usage: npm run simulate:game -- <ROOM CODE> [players 1-3]");
  process.exit(1);
}
const count = Math.max(1, Math.min(3, Number(countArg) || 2));
const NAMES = ["sim_sophia", "sim_timothy", "sim_emily"];
const PIN = "1111";
const bots = [];

async function send(method, path, body, cookie) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  const set = res.headers.getSetCookie?.().find((c) => c.startsWith("stem_session="));
  return set ? { ...data, cookie: set.split(";")[0] } : data;
}

const post = (path, body, cookie) => send("POST", path, body, cookie);

async function makeBot(n) {
  const ref = await send("GET", "/reference-data");
  const username = `${NAMES[n]}_${Math.floor(1000 + Math.random() * 9000)}`;
  const { user, cookie } = await post("/signup", {
    fullName: "Sim",
    username,
    pin: PIN,
    schoolLevelId: ref.schoolLevels[0].id,
    orgId: ref.organisations[0].id,
    recoveryColourId: ref.recoveryColours[0].id,
    recoverySubjectId: ref.recoverySubjects[0].id,
    consent: true,
  });
  const bot = { id: String(user.userId), name: username, cookie };
  bots.push(bot);
  return bot;
}

process.on("SIGINT", async () => {
  await Promise.all(bots.map((b) => send("DELETE", "/me", { pin: PIN }, b.cookie).catch(() => {})));
  console.log(`
Removed ${bots.length} pretend player account(s).`);
  process.exit(0);
});

async function* events(url, cookie) {
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (ev && data) yield { ev, data: JSON.parse(data) };
    }
  }
}

async function runPlayer(n) {
  const { id, name, cookie } = await makeBot(n);
  const act = (type, payload) => post(`/game-rooms/${code}/action`, { type, payload }, cookie);
  await post(`/game-rooms/${code}/join`, {}, cookie);
  console.log(`${name} joined ${code.toUpperCase()}`);
  setTimeout(() => act("ready", { ready: true }), 800 + n * 500);

  let playingFor = null;
  for await (const { ev, data: room } of events(`${API}/api/game-rooms/${code.toUpperCase()}/events`, cookie)) {
    if (ev !== "room") continue;
    if (!room.players.some((p) => p.id === id)) {
      console.log(`${name} left`);
      return;
    }
    if (room.status === "lobby" && playingFor && !room.players.find((p) => p.id === id)?.ready) {
      playingFor = null;
      act("ready", { ready: true });
    }
    if (room.status === "playing" && playingFor !== room.startedAt) {
      playingFor = room.startedAt;
      const target = 45 + Math.round(Math.random() * 45);
      const steps = 20;
      const wait = Math.max(0, room.startedAt - Date.now());
      console.log(`${name} is playing (aiming for ${target}/100)`);
      setTimeout(async () => {
        for (let s = 1; s <= steps; s++) {
          await new Promise((r) => setTimeout(r, 2500 + Math.random() * 1500));
          const progress = s / steps;
          await act(s === steps ? "finish" : "progress", { score: Math.round(target * progress), progress }).catch(() => {});
        }
        console.log(`${name} finished with ${target}`);
      }, wait);
    }
  }
}

Promise.all(Array.from({ length: count }, (_, n) => runPlayer(n))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
