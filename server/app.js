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
import db, { ORGANISATIONS, OTHER_ORG_NAME } from "./db.js";
import {
  BEATS_BY_ID,
  LESSONS,
  REPLAY_REWARD,
  REPLAYS_PER_DAY,
  botNameForBeat,
  levelForXp,
  pointsFor,
} from "./lessons.js";
import { findPack, rollPack } from "./cards.js";
import { AVATAR_KEYS } from "./avatars.js";
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
const USERNAME_MAX = 32;
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

/** A username that could belong to an account. Others are rejected without
 *  being written to login_attempts, so junk can't bloat the table. */
function plausibleUsername(username) {
  return username.length <= 64 && USERNAME_REGEX.test(username);
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
const ORG_PLACEHOLDERS = ORGANISATIONS.map(() => "?").join(", ");

app.get("/api/reference-data", (req, res) => {
  // Only the fixed list of centres. "Others" is a separate option on the form,
  // and anything added by the old public POST /api/organisations is hidden.
  const organisations = db
    .prepare(
      `SELECT org_id AS id, org_name AS name FROM organisations
       WHERE org_name IN (${ORG_PLACEHOLDERS}) ORDER BY org_id`,
    )
    .all(...ORGANISATIONS);
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
    if (!username || !USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        error: "Username can only contain letters, numbers, and underscores.",
      });
    }
    if (username.length > USERNAME_MAX) {
      return res.status(400).json({ error: `Username must be ${USERNAME_MAX} characters or fewer.` });
    }
    if (!PIN_REGEX.test(pin)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits." });
    }

    // "Others (please specify)": keep the typed name as free text on the user
    // and point org_id at the fixed "Other" row.
    let organisationId;
    let orgOtherText = null;
    if (typeof orgOther === "string" && orgOther.trim()) {
      orgOtherText = orgOther.trim();
      if (orgOtherText.length > NAME_MAX) {
        return res.status(400).json({
          error: `Organisation name must be ${NAME_MAX} characters or fewer.`,
        });
      }
      organisationId = db
        .prepare("SELECT org_id FROM organisations WHERE org_name = ?")
        .get(OTHER_ORG_NAME)?.org_id;
    } else {
      const id = toId(orgId);
      organisationId =
        id &&
        db
          .prepare(`SELECT org_id FROM organisations WHERE org_id = ? AND org_name IN (${ORG_PLACEHOLDERS})`)
          .get(id, ...ORGANISATIONS)?.org_id;
    }

    const levelId = toId(schoolLevelId);
    const colourId = toId(recoveryColourId);
    const subjectId = toId(recoverySubjectId);
    if (!levelId || !organisationId || !colourId || !subjectId) {
      return res.status(400).json({ error: "Please complete all fields." });
    }
    const refsExist =
      db.prepare("SELECT 1 FROM school_levels WHERE level_id = ?").get(levelId) &&
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
          (full_name, username, pin_hash, school_level_id, org_id, org_other, recovery_colour_id, recovery_subject_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fullName.trim(),
        username,
        pinHash,
        levelId,
        organisationId,
        orgOtherText,
        colourId,
        subjectId,
      );

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
      if (username && plausibleUsername(username)) logAttempt(username, false);
      return res.status(400).json({ error: "Enter your username and PIN." });
    }
    if (!plausibleUsername(username)) {
      return res.status(401).json({ error: "Incorrect username or PIN." });
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
  if (!plausibleUsername(username)) {
    return res.status(401).json({ error: "Those answers don't match our records." });
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
// Delete my account and everything stored about me
// ---------------------------------------------------------
const deleteUserTx = db.transaction((userId) => {
  const user = getUserRow(userId);
  if (!user) return;
  db.prepare("DELETE FROM lesson_progress WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM user_cards WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM reflections WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM beat_replays WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM login_attempts WHERE username = ?").run(user.username);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
});

app.delete("/api/user/me", requireUser, (req, res) => {
  deleteUserTx(req.userId);
  destroySession(req, res);
  res.json({ success: true });
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

const PROGRESS_STATUSES = new Set(["in_progress", "completed"]);

/** Adds XP/atoms to a user and recomputes their level (call inside a transaction). */
function addRewards(userId, { xp, atoms }) {
  if (!xp && !atoms) return;
  const row = db.prepare("SELECT xp, atoms FROM users WHERE user_id = ?").get(userId);
  const newXp = row.xp + xp;
  db.prepare(
    "UPDATE users SET xp = ?, level = ?, atoms = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(newXp, levelForXp(newXp), row.atoms + atoms, userId);
}

// Records progress; rewards are granted only the first time a beat is completed.
const saveProgressTx = db.transaction((userId, beat, status, score) => {
  const existing = db
    .prepare("SELECT status FROM lesson_progress WHERE user_id = ? AND lesson_id = ?")
    .get(userId, beat.id);
  const alreadyDone = existing?.status === "completed";
  const newStatus = alreadyDone ? "completed" : status;

  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, score, last_accessed, completed_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       score = COALESCE(excluded.score, lesson_progress.score),
       last_accessed = CURRENT_TIMESTAMP,
       completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)`,
  ).run(userId, beat.id, newStatus, score, newStatus);

  if (newStatus !== "completed" || alreadyDone) return { xp: 0, atoms: 0 };
  const awarded = pointsFor(beat, score);
  addRewards(userId, awarded);
  return awarded;
});

// Replaying a finished game: small top-up, at most REPLAYS_PER_DAY per game per 24 h.
const replayTx = db.transaction((userId, beat) => {
  const done = db
    .prepare(
      "SELECT 1 FROM lesson_progress WHERE user_id = ? AND lesson_id = ? AND status = 'completed'",
    )
    .get(userId, beat.id);
  if (!done) return null;
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM beat_replays
       WHERE user_id = ? AND beat_id = ? AND replayed_at > datetime('now','-1 day')`,
    )
    .get(userId, beat.id);
  if (n >= REPLAYS_PER_DAY) return { xp: 0, atoms: 0 };
  db.prepare("INSERT INTO beat_replays (user_id, beat_id) VALUES (?, ?)").run(userId, beat.id);
  addRewards(userId, REPLAY_REWARD);
  return { ...REPLAY_REWARD };
});

app.post("/api/progress", requireUser, (req, res) => {
  const { lessonId, status, score, replay } = req.body || {};
  const beat = typeof lessonId === "string" ? BEATS_BY_ID.get(lessonId) : undefined;
  if (!beat) return res.status(400).json({ error: "Unknown lesson." });

  let awarded;
  if (replay === true) {
    if (beat.type !== "simulation") {
      return res.status(400).json({ error: "Only games can be replayed for rewards." });
    }
    awarded = replayTx(req.userId, beat);
    if (!awarded) return res.status(400).json({ error: "Finish this game once before replaying it." });
  } else {
    if (!PROGRESS_STATUSES.has(status)) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const safeScore =
      typeof score === "number" && Number.isFinite(score)
        ? Math.max(0, Math.min(100, Math.round(score)))
        : null;
    awarded = saveProgressTx(req.userId, beat, status, safeScore);
  }

  res.json({ success: true, awarded, user: publicUser(getUserRow(req.userId)) });
});

app.post("/api/user/avatar", requireUser, (req, res) => {
  const { avatar } = req.body || {};
  if (typeof avatar !== "string" || !AVATAR_KEYS.includes(avatar)) {
    return res.status(400).json({ error: "Please pick one of the avatars." });
  }

  db.prepare(
    "UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(avatar, req.userId);

  res.json({ success: true });
});

// ---------------------------------------------------------
// Exit-card reflections (shown in the Gallery to signed-in students).
// Only the author's first name and avatar are shared.
// ---------------------------------------------------------
app.post("/api/reflections", requireUser, (req, res) => {
  const { beatId, caption } = req.body || {};
  const beat = typeof beatId === "string" ? BEATS_BY_ID.get(beatId) : undefined;
  if (!beat || beat.type !== "exit") return res.status(400).json({ error: "Unknown lesson." });
  const text = typeof caption === "string" ? caption.trim() : "";
  if (!text || text.length > REFLECTION_MAX) {
    return res.status(400).json({
      error: `Reflections must be between 1 and ${REFLECTION_MAX} characters.`,
    });
  }
  const info = db
    .prepare("INSERT OR IGNORE INTO reflections (user_id, beat_id, caption) VALUES (?, ?, ?)")
    .run(req.userId, beat.id, text);
  if (info.changes === 0) {
    return res.status(409).json({ error: "You already shared a reflection for this lesson." });
  }
  res.status(201).json({ reflection: reflectionById(info.lastInsertRowid) });
});

const REFLECTION_SELECT = `
  SELECT r.id, r.beat_id, r.caption, r.created_at, u.full_name, u.avatar
  FROM reflections r JOIN users u ON u.user_id = r.user_id`;

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

function reflectionById(id) {
  return toPublicReflection(db.prepare(`${REFLECTION_SELECT} WHERE r.id = ?`).get(id));
}

app.get("/api/reflections", requireUser, (req, res) => {
  const rows = db.prepare(`${REFLECTION_SELECT} ORDER BY r.id DESC LIMIT 50`).all();
  res.json({ reflections: rows.map(toPublicReflection) });
});

// ---------------------------------------------------------
// Leaderboard — top 20 by XP (username, avatar and XP only)
// ---------------------------------------------------------
app.get("/api/leaderboard", requireUser, (req, res) => {
  const entries = db
    .prepare("SELECT username, avatar, xp FROM users ORDER BY xp DESC LIMIT 20")
    .all();
  res.json({ entries });
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

// ---------------------------------------------------------
// Production: serve the built frontend (npm run build -> dist/) from the same
// origin as the API, with an SPA fallback for client-side routes.
// ---------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "../dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
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
