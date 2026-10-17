import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { rpc } from "./db.js";
import { route } from "./route.js";
import {
  BEATS_BY_ID,
  LESSONS,
  REPLAY_REWARD,
  REPLAYS_PER_DAY,
  botNameForBeat,
  pointsFor,
} from "./lessons.js";
import { findPack, rollPack } from "./cards.js";
import { AVATAR_KEYS } from "./avatars.js";
import { COOKIE_SECRET, createSession, destroySession, requireUser } from "./auth.js";
import { PIN_REGEX, USERNAME_REGEX, USERNAME_RULE, publicUser } from "./users.js";
import accountRoutes from "./routes/account.js";
import socialRoutes from "./routes/social.js";
import adminRoutes from "./routes/admin.js";
import storyRoutes from "./routes/story.js";
import { registerGameRoutes } from "./gameRooms.js";

// Overridable so the model can be changed without a code edit.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const app = express();
app.disable("x-powered-by");
// Behind a host's proxy (Render, Railway, ...) this makes req.ip the real
// client IP, which the per-IP rate limits below depend on.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

// Only the app's own origin may call the API with the session cookie.
app.use(cors({ origin: process.env.APP_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser(COOKIE_SECRET));

// Sign-in accepts any username an older account might have; new usernames
// must match USERNAME_REGEX (3–20 characters) from users.js.
const LOGIN_USERNAME_REGEX = /^[A-Za-z0-9_]+$/;
const NAME_MAX = 80;
const REFLECTION_MAX = 280;

const LOCKOUT_FAILURES = 5;
const LOCKOUT_MESSAGE = "Too many tries — ask your teacher or wait 15 minutes";

// ---------------------------------------------------------
// Per-IP limit on the sign-in / sign-up / recovery endpoints. A student-care
// centre may put many children behind one IP, so this is env-tunable.
// ---------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.AUTH_RATE_LIMIT_PER_MIN) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many tries — please wait a minute and try again." },
});
app.use(["/api/login", "/api/signup", "/api/recover", "/api/admin/login"], authLimiter);

// In-memory store for short-lived PIN-reset tokens (username -> {token, expiresAt}).
// Fine for a small deployment; swap for Redis if you scale this up.
const resetTokens = new Map();

function issueResetToken(username) {
  const token = crypto.randomBytes(24).toString("hex");
  resetTokens.set(username, {
    token,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return token;
}

function consumeResetToken(username, token) {
  const entry = resetTokens.get(username);
  if (!entry) return false;
  resetTokens.delete(username);
  const a = Buffer.from(entry.token);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b) && entry.expiresAt > Date.now();
}

const logAttempt = (username, success) =>
  rpc("stem_log_attempt", { p_username: username, p_success: success });

/** True once a username has 5+ failed sign-in/recovery attempts in 15 minutes.
 *  Case-insensitive, like sign-in, so changing the case can't reset the count. */
async function isLockedOut(username) {
  return (await rpc("stem_recent_failures", { p_username: username })) >= LOCKOUT_FAILURES;
}

/** A username that could belong to an account. Others are rejected without
 *  being written to login_attempts, so junk can't bloat the table. */
function plausibleUsername(username) {
  return username.length <= 64 && LOGIN_USERNAME_REGEX.test(username);
}

/** Positive integer from a number or numeric string, else null. */
function toId(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------
// Reference data for the sign-up dropdowns (also the host's health check)
// ---------------------------------------------------------
app.get("/api/reference-data", route(async (req, res) => {
  // The fixed list of centres; "Others" is a separate option on the form.
  const data = await rpc("stem_reference_data");
  res.json({
    organisations: data.organisations,
    schoolLevels: data.schoolLevels,
    recoveryColours: data.recoveryColours,
    recoverySubjects: data.recoverySubjects,
  });
}));

// ---------------------------------------------------------
// Sign up
// ---------------------------------------------------------
app.post("/api/signup", async (req, res) => {
  try {
    const {
      fullName,
      schoolLevelId,
      orgId,
      username,
      pin,
      recoveryColourId,
      recoverySubjectId,
      orgOther,
      consent,
    } = req.body || {};

    if (typeof username !== "string" || typeof pin !== "string") {
      return res.status(400).json({ error: "Please complete all fields." });
    }
    if (typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ error: "First name is required." });
    }
    if (fullName.trim().length > NAME_MAX) {
      return res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer.` });
    }
    if (consent !== true) {
      return res.status(400).json({
        error: "Please ask your parent or teacher, then tick the box to join.",
      });
    }
    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({ error: USERNAME_RULE });
    }
    if (!PIN_REGEX.test(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits." });
    }

    // "Others (please specify)": keep the typed name as free text on the user;
    // the database points org_id at the fixed "Other" row.
    let orgOtherText = null;
    if (typeof orgOther === "string" && orgOther.trim()) {
      orgOtherText = orgOther.trim();
      if (orgOtherText.length > NAME_MAX) {
        return res.status(400).json({
          error: `Organisation name must be ${NAME_MAX} characters or fewer.`,
        });
      }
    }

    const organisationId = orgOtherText ? null : toId(orgId);
    const levelId = toId(schoolLevelId);
    const colourId = toId(recoveryColourId);
    const subjectId = toId(recoverySubjectId);
    if (!levelId || (!orgOtherText && !organisationId) || !colourId || !subjectId) {
      return res.status(400).json({ error: "Please complete all fields." });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    // Checks the drop-down ids exist and the username is free, then saves the account.
    const result = await rpc("stem_signup", {
      p_full_name: fullName.trim(),
      p_username: username,
      p_pin_hash: pinHash,
      p_school_level_id: levelId,
      p_org_id: organisationId,
      p_org_other: orgOtherText,
      p_recovery_colour_id: colourId,
      p_recovery_subject_id: subjectId,
    });
    if (result.error === "taken") {
      return res.status(409).json({ error: "That username is already taken." });
    }
    if (result.error) {
      return res.status(400).json({ error: "Please complete all fields." });
    }

    await createSession(res, result.user.user_id);
    res.status(201).json({ user: publicUser(result.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating the account." });
  }
});

// ---------------------------------------------------------
// Sign in
// ---------------------------------------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { username, pin } = req.body || {};
    if (typeof username !== "string" || typeof pin !== "string") {
      return res.status(400).json({ error: "Enter your username and PIN." });
    }
    if (!username || !pin) {
      if (username && plausibleUsername(username)) await logAttempt(username, false);
      return res.status(400).json({ error: "Enter your username and PIN." });
    }
    if (!plausibleUsername(username)) {
      return res.status(401).json({ error: "Incorrect username or PIN." });
    }

    if (await isLockedOut(username)) {
      return res.status(429).json({ error: LOCKOUT_MESSAGE });
    }

    // The account (exact name first, then ignoring case) and its PIN hash.
    const found = await rpc("stem_user_for_login", { p_username: username });
    const ok = found && PIN_REGEX.test(pin) && (await bcrypt.compare(pin, found.pin_hash));
    if (!ok) {
      await logAttempt(found?.user.username ?? username, false);
      return res.status(401).json({ error: "Incorrect username or PIN." });
    }

    await logAttempt(found.user.username, true);
    await createSession(res, found.user.user_id);
    res.json({ user: publicUser(found.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ---------------------------------------------------------
// Sign out
// ---------------------------------------------------------
app.post("/api/logout", route(async (req, res) => {
  await destroySession(req, res);
  res.json({ success: true });
}));

// ---------------------------------------------------------
// Forgot PIN — step 1: verify recovery answers
// ---------------------------------------------------------
app.post("/api/recover/verify", route(async (req, res) => {
  const { username, recoveryColourId, recoverySubjectId } = req.body || {};
  if (typeof username !== "string") {
    return res.status(400).json({ error: "Please complete all fields." });
  }
  const colourId = toId(recoveryColourId);
  const subjectId = toId(recoverySubjectId);
  if (!username || !colourId || !subjectId) {
    return res.status(400).json({ error: "Please complete all fields." });
  }
  if (!plausibleUsername(username)) {
    return res.status(401).json({ error: "Those answers don't match our records." });
  }

  if (await isLockedOut(username)) {
    return res.status(429).json({ error: LOCKOUT_MESSAGE });
  }

  const user = await rpc("stem_recovery_answers", { p_username: username });
  if (!user || user.recovery_colour_id !== colourId || user.recovery_subject_id !== subjectId) {
    await logAttempt(username, false);
    return res.status(401).json({ error: "Those answers don't match our records." });
  }

  const token = issueResetToken(username);
  res.json({ resetToken: token });
}));

// ---------------------------------------------------------
// Forgot PIN — step 2: set new PIN
// ---------------------------------------------------------
app.post("/api/recover/reset", async (req, res) => {
  try {
    const { username, resetToken, newPin } = req.body || {};
    if (
      typeof username !== "string" ||
      typeof resetToken !== "string" ||
      typeof newPin !== "string"
    ) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!username || !resetToken || !newPin) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (!PIN_REGEX.test(newPin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits." });
    }
    if (!consumeResetToken(username, resetToken)) {
      return res.status(401).json({ error: "That reset session has expired. Please try again." });
    }

    const pinHash = await bcrypt.hash(newPin, 10);
    // A new PIN also signs the account out of every other device.
    await rpc("stem_set_pin_for_username", { p_username: username, p_pin_hash: pinHash });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// The signed-in user, profile edits, data export and account deletion live in
// routes/account.js (mounted below).

// ---------------------------------------------------------
// Lesson progress (always for the signed-in user)
// ---------------------------------------------------------
app.get("/api/progress", requireUser, route(async (req, res) => {
  res.json({ progress: await rpc("stem_progress_list", { p_user_id: req.userId }) });
}));

const PROGRESS_STATUSES = new Set(["in_progress", "completed"]);

app.post("/api/progress", requireUser, route(async (req, res) => {
  const { lessonId, status, score, replay } = req.body || {};
  const beat = typeof lessonId === "string" ? BEATS_BY_ID.get(lessonId) : undefined;
  if (!beat) return res.status(400).json({ error: "Unknown lesson." });

  let result;
  if (replay === true) {
    if (beat.type !== "simulation") {
      return res.status(400).json({ error: "Only games can be replayed for rewards." });
    }
    // Replaying a finished game: small top-up, at most REPLAYS_PER_DAY per game per 24 h.
    result = await rpc("stem_progress_replay", {
      p_user_id: req.userId,
      p_lesson_id: beat.id,
      p_max_per_day: REPLAYS_PER_DAY,
      p_xp: REPLAY_REWARD.xp,
      p_atoms: REPLAY_REWARD.atoms,
    });
    if (!result) return res.status(400).json({ error: "Finish this game once before replaying it." });
  } else {
    if (!PROGRESS_STATUSES.has(status)) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const safeScore =
      typeof score === "number" && Number.isFinite(score)
        ? Math.max(0, Math.min(100, Math.round(score)))
        : null;
    // Rewards are granted only the first time a beat is completed.
    const points = pointsFor(beat, safeScore);
    result = await rpc("stem_progress_save", {
      p_user_id: req.userId,
      p_lesson_id: beat.id,
      p_status: status,
      p_score: safeScore,
      p_xp: points.xp,
      p_atoms: points.atoms,
    });
  }

  res.json({ success: true, awarded: result.awarded, user: publicUser(result.user) });
}));

app.post("/api/user/avatar", requireUser, route(async (req, res) => {
  const { avatar } = req.body || {};
  if (typeof avatar !== "string" || !AVATAR_KEYS.includes(avatar)) {
    return res.status(400).json({ error: "Please pick one of the avatars." });
  }

  await rpc("stem_set_avatar", { p_user_id: req.userId, p_avatar: avatar });

  res.json({ success: true });
}));

// ---------------------------------------------------------
// Exit-card reflections (shown in the Gallery to signed-in students).
// Only the author's first name and avatar are shared.
// ---------------------------------------------------------
app.post("/api/reflections", requireUser, route(async (req, res) => {
  const { beatId, caption } = req.body || {};
  const beat = typeof beatId === "string" ? BEATS_BY_ID.get(beatId) : undefined;
  if (!beat || beat.type !== "exit") return res.status(400).json({ error: "Unknown lesson." });
  const text = typeof caption === "string" ? caption.trim() : "";
  if (!text || text.length > REFLECTION_MAX) {
    return res.status(400).json({
      error: `Reflections must be between 1 and ${REFLECTION_MAX} characters.`,
    });
  }
  // Null when the student already shared one for this exit card.
  const row = await rpc("stem_reflection_add", { p_user_id: req.userId, p_beat_id: beat.id, p_caption: text });
  if (!row) {
    return res.status(409).json({ error: "You already shared a reflection for this lesson." });
  }
  res.status(201).json({ reflection: toPublicReflection(row) });
}));

function toPublicReflection(row) {
  return {
    id: row.id,
    firstName: String(row.full_name).trim().split(/\s+/)[0],
    avatar: row.avatar,
    caption: row.caption,
    beatTitle: BEATS_BY_ID.get(row.beat_id)?.title ?? "",
    createdAt: row.created_at,
  };
}

app.get("/api/reflections", requireUser, route(async (req, res) => {
  const rows = await rpc("stem_reflections_recent", { p_limit: 50 });
  res.json({ reflections: rows.map(toPublicReflection) });
}));

// ---------------------------------------------------------
// Collectible cards — packs are paid for and rolled on the server
// ---------------------------------------------------------
app.get("/api/cards", requireUser, route(async (req, res) => {
  const owned = {};
  for (const r of await rpc("stem_cards_owned", { p_user_id: req.userId })) owned[r.card_id] = r.count;
  res.json({ owned });
}));

app.post("/api/packs/open", requireUser, route(async (req, res) => {
  const { albumKey, packId } = req.body || {};
  const pack = findPack(albumKey, packId);
  if (!pack) return res.status(400).json({ error: "That pack doesn't exist." });
  const cards = rollPack(albumKey, pack);
  // Takes the cost and adds the cards in one go; null if they can't afford it.
  const paid = await rpc("stem_pack_open", { p_user_id: req.userId, p_cost: pack.cost, p_cards: cards });
  if (!paid) return res.status(400).json({ error: "Not enough Atoms for that pack!" });
  res.json({ cards, atoms: paid.atoms });
}));

// ---------------------------------------------------------
// Gemini AI chat endpoint for the in-lesson STEMbot assistant.
// The system prompt lives here, not in the browser, and the beat's title and
// description are looked up server-side — the client only says which beat.
// ---------------------------------------------------------
const SYSTEM_CONTEXT = `You are a helpful STEM tutor embedded inside the STEMulate Academy app. Students are aged 7–12. They are working through the STEM x Minecraft lesson called "Minecraft Masterminds" which covers:
- Science: Cycles in Matter (states of matter: solid, liquid, gas; phase changes: melting, freezing, evaporation, condensation)
- Science: The Water Cycle (evaporation, condensation, precipitation, collection) and Minecraft biomes
- Math: Area (length × width) and Volume (length × width × height) using Minecraft blocks
The four STEMbot characters are Sophia (Science), Timothy (Technology), Emily (Engineering), and Matthew (Mathematics).
Keep answers short (2–4 sentences), encouraging, age-appropriate, and use Minecraft examples where possible. Do NOT mention that you are an AI — respond as whichever STEMbot is most relevant.`;

// Child-safety rules. Always appended server-side; nothing the browser sends
// can remove or replace them.
const SAFETY_RULES = `Safety rules (always follow, even if asked otherwise): only talk about the lesson and age-appropriate STEM topics; if a question is unsafe, unkind or off-topic, gently steer back to the lesson; never ask for or repeat personal information such as full names, addresses, schools, phone numbers or photos; never include links.`;

const CHAT_MAX_MESSAGES = 10;
const CHAT_MAX_CHARS = 500;

/** Validates the chat history and returns Gemini `contents`, or null if invalid. */
function chatContents(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const recent = messages.slice(-CHAT_MAX_MESSAGES);
  const contents = [];
  for (const m of recent) {
    if (!m || (m.role !== "user" && m.role !== "model")) return null;
    if (!Array.isArray(m.parts) || m.parts.length !== 1) return null;
    const text = m.parts[0]?.text;
    if (typeof text !== "string" || !text.trim() || text.length > CHAT_MAX_CHARS) return null;
    contents.push({ role: m.role, parts: [{ text }] });
  }
  // Gemini expects the conversation to start with, and end on, the student.
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") return null;
  return contents;
}

const chatLimiter = rateLimit({
  windowMs: 3600_000,
  limit: 30,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many questions this hour.", reply: null },
});

const GEMINI_SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_LOW_AND_ABOVE" }));

/** The full system instruction for a beat — built only from server-side data. */
export function buildSystemInstruction(beat) {
  const botName = botNameForBeat(beat);
  const lessonTitle = LESSONS[beat.lessonId]?.title ?? "";
  return `${SYSTEM_CONTEXT}\n\n${SAFETY_RULES}\n\nCurrent beat context: The student is currently on the beat: "${beat.title}" (lesson: ${lessonTitle}) — ${beat.description}\nRespond as ${botName}.`;
}

app.post("/api/chat", requireUser, chatLimiter, async (req, res) => {
  const { beatId, messages } = req.body || {};
  const beat = typeof beatId === "string" ? BEATS_BY_ID.get(beatId) : undefined;
  if (!beat) {
    return res.status(400).json({ error: "Unknown lesson.", reply: null });
  }
  const contents = chatContents(messages);
  if (!contents) {
    return res.status(400).json({
      error: `Send up to ${CHAT_MAX_MESSAGES} messages of at most ${CHAT_MAX_CHARS} characters.`,
      reply: null,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured", reply: null });
  }

  try {
    const systemInstruction = buildSystemInstruction(beat);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[chat] user=${req.userId} beat=${beat.id} turns=${contents.length}`);
    }
    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        // Key goes in a header, never the URL (URLs end up in logs).
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, err.slice(0, 500));
      return res.status(502).json({ error: "Gemini API error", reply: null });
    }

    const data = await geminiRes.json();
    const reply = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (!reply) {
      // Blocked by the safety filters or otherwise empty — never send a blank bubble.
      return res.status(502).json({ error: "Empty reply", reply: null });
    }
    res.json({ reply });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(502).json({ error: "Chat is unavailable right now.", reply: null });
  }
});

// ---------------------------------------------------------
// Account, friends & chats, admin page, lesson-game scores and live rooms
// ---------------------------------------------------------
app.use("/api/admin", adminRoutes);
app.use("/api", accountRoutes);
app.use("/api", socialRoutes);
app.use("/api", storyRoutes);
registerGameRoutes(app);

// ---------------------------------------------------------
// Production: serve the built frontend (npm run build -> dist/) from the same
// origin as the API, with an SPA fallback for client-side routes.
// ---------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The public STEMulate website (website/, plain HTML) is its own Render static
// site at WEBSITE_URL (https://projstemulate.com), so on the host old /site
// links go there. Without WEBSITE_URL (your own computer) it is served at
// /site, so one `npm start` previews both.
const WEBSITE_DIR = path.join(__dirname, "../website");
const WEBSITE_URL = (process.env.WEBSITE_URL ?? "").trim().replace(/\/+$/, "");
if (WEBSITE_URL) {
  app.get(/^\/site(\/.*)?$/, (req, res) => res.redirect(301, WEBSITE_URL + (req.params[0] ?? "/")));
} else {
  app.get(/^\/site$/, (_req, res) => res.redirect(301, "/site/"));
  app.use("/site", express.static(WEBSITE_DIR, { redirect: false }));
}

const DIST_DIR = path.join(__dirname, "../dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/(api|site)(\/|$)).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
}

// Unknown API routes get a JSON 404 (not Express's HTML page).
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Final error handler — never leak stack traces or HTML to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Something went wrong." : "Bad request." });
});

export default app;
