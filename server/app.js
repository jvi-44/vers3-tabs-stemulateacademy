import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "./db.js";
import { BEATS_BY_ID, LESSONS, botNameForBeat } from "./lessons.js";
import { findPack, rollPack } from "./cards.js";
import {
  COOKIE_SECRET,
  createSession,
  destroySession,
  destroyAllSessionsFor,
  requireUser,
} from "./auth.js";

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

const PIN_REGEX = /^\d{4}$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;

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
app.use(["/api/login", "/api/signup", "/api/recover"], authLimiter);

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

function logAttempt(username, success) {
  db.prepare("INSERT INTO login_attempts (username, success) VALUES (?, ?)").run(
    username,
    success ? 1 : 0,
  );
}

/** True once a username has 5+ failed sign-in/recovery attempts in 15 minutes. */
function isLockedOut(username) {
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE username = ? AND success = 0 AND attempted_at > datetime('now','-15 minutes')`,
    )
    .get(username);
  return n >= LOCKOUT_FAILURES;
}

/** Positive integer from a number or numeric string, else null. */
function toId(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function publicUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    username: row.username,
    schoolLevelId: row.school_level_id,
    orgId: row.org_id,
    xp: row.xp,
    level: row.level,
    atoms: row.atoms,
    avatar: row.avatar,
  };
}

function getUserRow(userId) {
  return db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
}

// ---------------------------------------------------------
// Reference data for the sign-up dropdowns
// ---------------------------------------------------------
app.get("/api/reference-data", (req, res) => {
  const organisations = db
    .prepare("SELECT org_id AS id, org_name AS name FROM organisations ORDER BY org_id")
    .all();
  const schoolLevels = db
    .prepare("SELECT level_id AS id, level_name AS name FROM school_levels ORDER BY level_id")
    .all();
  const recoveryColours = db
    .prepare("SELECT colour_id AS id, colour_name AS name FROM recovery_colours ORDER BY colour_id")
    .all();
  const recoverySubjects = db
    .prepare("SELECT subject_id AS id, subject_name AS name FROM recovery_subjects ORDER BY subject_id")
    .all();

  res.json({ organisations, schoolLevels, recoveryColours, recoverySubjects });
});

// ---------------------------------------------------------
// Create a custom organisation (used by the "Others (please specify)"
// option on the sign-up form). Returns the id whether it's newly created
// or already existed, so this is safe to call more than once.
// ---------------------------------------------------------
app.post("/api/organisations", (req, res) => {
  const { name } = req.body || {};
  const trimmed = (typeof name === "string" ? name : "").trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Please enter your organisation's name." });
  }

  db.prepare("INSERT OR IGNORE INTO organisations (org_name) VALUES (?)").run(trimmed);
  const row = db
    .prepare("SELECT org_id AS id, org_name AS name FROM organisations WHERE org_name = ?")
    .get(trimmed);

  res.status(201).json({ organisation: row });
});

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
    } = req.body || {};

    if (typeof username !== "string" || typeof pin !== "string") {
      return res.status(400).json({ error: "Please complete all fields." });
    }
    if (typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }
    if (!username || !USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        error: "Username can only contain letters, numbers, and underscores.",
      });
    }
    if (!PIN_REGEX.test(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits." });
    }

    const levelId = toId(schoolLevelId);
    const organisationId = toId(orgId);
    const colourId = toId(recoveryColourId);
    const subjectId = toId(recoverySubjectId);
    if (!levelId || !organisationId || !colourId || !subjectId) {
      return res.status(400).json({ error: "Please complete all fields." });
    }
    const refsExist =
      db.prepare("SELECT 1 FROM school_levels WHERE level_id = ?").get(levelId) &&
      db.prepare("SELECT 1 FROM organisations WHERE org_id = ?").get(organisationId) &&
      db.prepare("SELECT 1 FROM recovery_colours WHERE colour_id = ?").get(colourId) &&
      db.prepare("SELECT 1 FROM recovery_subjects WHERE subject_id = ?").get(subjectId);
    if (!refsExist) {
      return res.status(400).json({ error: "Please complete all fields." });
    }

    const existing = db
      .prepare("SELECT user_id FROM users WHERE username = ?")
      .get(username);
    if (existing) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const info = db
      .prepare(
        `INSERT INTO users
          (full_name, username, pin_hash, school_level_id, org_id, recovery_colour_id, recovery_subject_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(fullName.trim(), username, pinHash, levelId, organisationId, colourId, subjectId);

    const user = getUserRow(info.lastInsertRowid);
    createSession(res, user.user_id);
    res.status(201).json({ user: publicUser(user) });
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
      if (username) logAttempt(username, false);
      return res.status(400).json({ error: "Enter your username and PIN." });
    }

    if (isLockedOut(username)) {
      return res.status(429).json({ error: LOCKOUT_MESSAGE });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    const ok = user && PIN_REGEX.test(pin) && (await bcrypt.compare(pin, user.pin_hash));
    if (!ok) {
      logAttempt(username, false);
      return res.status(401).json({ error: "Incorrect username or PIN." });
    }

    logAttempt(username, true);
    createSession(res, user.user_id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ---------------------------------------------------------
// Sign out
// ---------------------------------------------------------
app.post("/api/logout", (req, res) => {
  destroySession(req, res);
  res.json({ success: true });
});

// ---------------------------------------------------------
// Forgot PIN — step 1: verify recovery answers
// ---------------------------------------------------------
app.post("/api/recover/verify", (req, res) => {
  const { username, recoveryColourId, recoverySubjectId } = req.body || {};
  if (typeof username !== "string") {
    return res.status(400).json({ error: "Please complete all fields." });
  }
  const colourId = toId(recoveryColourId);
  const subjectId = toId(recoverySubjectId);
  if (!username || !colourId || !subjectId) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  if (isLockedOut(username)) {
    return res.status(429).json({ error: LOCKOUT_MESSAGE });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || user.recovery_colour_id !== colourId || user.recovery_subject_id !== subjectId) {
    logAttempt(username, false);
    return res.status(401).json({ error: "Those answers don't match our records." });
  }

  const token = issueResetToken(username);
  res.json({ resetToken: token });
});

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
    const user = db.prepare("SELECT user_id FROM users WHERE username = ?").get(username);
    db.prepare(
      "UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
    ).run(pinHash, username);
    // A new PIN signs the account out of every other device.
    if (user) destroyAllSessionsFor(user.user_id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ---------------------------------------------------------
// The signed-in user (used to rehydrate on page refresh)
// ---------------------------------------------------------
app.get("/api/user/me", requireUser, (req, res) => {
  const user = getUserRow(req.userId);
  if (!user) return res.status(401).json({ error: "Please sign in again." });
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------
// Lesson progress (always for the signed-in user)
// ---------------------------------------------------------
app.get("/api/progress", requireUser, (req, res) => {
  const rows = db
    .prepare("SELECT lesson_id, status, score FROM lesson_progress WHERE user_id = ?")
    .all(req.userId);
  res.json({ progress: rows });
});

const PROGRESS_STATUSES = new Set(["not_started", "in_progress", "completed"]);

app.post("/api/progress", requireUser, (req, res) => {
  const { lessonId, status, score } = req.body || {};
  if (
    typeof lessonId !== "string" ||
    !lessonId ||
    lessonId.length > 64 ||
    !PROGRESS_STATUSES.has(status)
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  const safeScore =
    typeof score === "number" && Number.isFinite(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : null;

  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, score, last_accessed, completed_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       score = excluded.score,
       last_accessed = CURRENT_TIMESTAMP,
       completed_at = CASE WHEN excluded.status = 'completed' THEN CURRENT_TIMESTAMP ELSE lesson_progress.completed_at END`,
  ).run(req.userId, lessonId, status, safeScore, status);

  res.json({ success: true });
});

app.post("/api/user/xp", requireUser, (req, res) => {
  const { xp, level, atoms } = req.body || {};
  const valid = [xp, level, atoms].every((n) => Number.isInteger(n) && n >= 0);
  if (!valid) return res.status(400).json({ error: "Invalid values." });

  db.prepare(
    "UPDATE users SET xp = ?, level = ?, atoms = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(xp, level, atoms, req.userId);

  res.json({ success: true });
});

app.post("/api/user/avatar", requireUser, (req, res) => {
  const { avatar } = req.body || {};
  if (typeof avatar !== "string" || !avatar || avatar.length > 64) {
    return res.status(400).json({ error: "Missing avatar." });
  }

  db.prepare(
    "UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(avatar, req.userId);

  res.json({ success: true });
});

// ---------------------------------------------------------
// Collectible cards — packs are paid for and rolled on the server
// ---------------------------------------------------------
app.get("/api/cards", requireUser, (req, res) => {
  const rows = db
    .prepare("SELECT card_id, count FROM user_cards WHERE user_id = ? AND count > 0")
    .all(req.userId);
  const owned = {};
  for (const r of rows) owned[r.card_id] = r.count;
  res.json({ owned });
});

const openPackTx = db.transaction((userId, albumKey, pack) => {
  const row = db.prepare("SELECT atoms FROM users WHERE user_id = ?").get(userId);
  if (!row || row.atoms < pack.cost) return null;
  db.prepare(
    "UPDATE users SET atoms = atoms - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(pack.cost, userId);
  const cards = rollPack(albumKey, pack);
  const upsert = db.prepare(
    `INSERT INTO user_cards (user_id, card_id, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, card_id) DO UPDATE SET count = count + 1`,
  );
  for (const cardId of cards) upsert.run(userId, cardId);
  return { cards, atoms: row.atoms - pack.cost };
});

app.post("/api/packs/open", requireUser, (req, res) => {
  const { albumKey, packId } = req.body || {};
  const pack = findPack(albumKey, packId);
  if (!pack) return res.status(400).json({ error: "That pack doesn't exist." });
  const result = openPackTx(req.userId, albumKey, pack);
  if (!result) return res.status(400).json({ error: "Not enough Atoms for that pack!" });
  res.json(result);
});

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
