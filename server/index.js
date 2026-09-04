import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const PIN_REGEX = /^\d{4}$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;

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
  const valid = entry.token === token && entry.expiresAt > Date.now();
  resetTokens.delete(username);
  return valid;
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
  const trimmed = (name || "").trim();
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
  const {
    fullName,
    schoolLevelId,
    orgId,
    username,
    pin,
    recoveryColourId,
    recoverySubjectId,
  } = req.body || {};

  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "Full name is required." });
  }
  if (!username || !USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      error: "Username can only contain letters, numbers, and underscores.",
    });
  }
  if (!pin || !PIN_REGEX.test(pin)) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  }
  if (!schoolLevelId || !orgId || !recoveryColourId || !recoverySubjectId) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  const existing = db
    .prepare("SELECT user_id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 10);
    const info = db
      .prepare(
        `INSERT INTO users
          (full_name, username, pin_hash, school_level_id, org_id, recovery_colour_id, recovery_subject_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fullName.trim(),
        username,
        pinHash,
        schoolLevelId,
        orgId,
        recoveryColourId,
        recoverySubjectId,
      );

    const user = db
      .prepare("SELECT * FROM users WHERE user_id = ?")
      .get(info.lastInsertRowid);

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
  const { username, pin } = req.body || {};
  const logAttempt = (success) =>
    db
      .prepare("INSERT INTO login_attempts (username, success) VALUES (?, ?)")
      .run(username || "", success ? 1 : 0);

  if (!username || !pin) {
    logAttempt(false);
    return res.status(400).json({ error: "Enter your username and PIN." });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) {
    logAttempt(false);
    return res.status(401).json({ error: "Incorrect username or PIN." });
  }

  const ok = await bcrypt.compare(pin, user.pin_hash);
  if (!ok) {
    logAttempt(false);
    return res.status(401).json({ error: "Incorrect username or PIN." });
  }

  logAttempt(true);
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------
// Forgot PIN — step 1: verify recovery answers
// ---------------------------------------------------------
app.post("/api/recover/verify", (req, res) => {
  const { username, recoveryColourId, recoverySubjectId } = req.body || {};
  if (!username || !recoveryColourId || !recoverySubjectId) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (
    !user ||
    user.recovery_colour_id !== Number(recoveryColourId) ||
    user.recovery_subject_id !== Number(recoverySubjectId)
  ) {
    return res.status(401).json({ error: "Those answers don't match our records." });
  }

  const token = issueResetToken(username);
  res.json({ resetToken: token });
});

// ---------------------------------------------------------
// Forgot PIN — step 2: set new PIN
// ---------------------------------------------------------
app.post("/api/recover/reset", async (req, res) => {
  const { username, resetToken, newPin } = req.body || {};
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
  db.prepare(
    "UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
  ).run(pinHash, username);

  res.json({ success: true });
});

// ---------------------------------------------------------
// Rehydrate a session (used on page refresh)
// ---------------------------------------------------------
app.get("/api/user/:userId", (req, res) => {
  const user = db
    .prepare("SELECT * FROM users WHERE user_id = ?")
    .get(req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------
// Lesson progress
// ---------------------------------------------------------
app.get("/api/progress/:userId", (req, res) => {
  const rows = db
    .prepare("SELECT lesson_id, status, score FROM lesson_progress WHERE user_id = ?")
    .all(req.params.userId);
  res.json({ progress: rows });
});

app.post("/api/progress", (req, res) => {
  const { userId, lessonId, status, score } = req.body || {};
  if (!userId || !lessonId || !status) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, status, score, last_accessed, completed_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       status = excluded.status,
       score = excluded.score,
       last_accessed = CURRENT_TIMESTAMP,
       completed_at = CASE WHEN excluded.status = 'completed' THEN CURRENT_TIMESTAMP ELSE lesson_progress.completed_at END`,
  ).run(userId, lessonId, status, score ?? null, status);

  res.json({ success: true });
});

app.post("/api/user/xp", (req, res) => {
  const { userId, xp, level, atoms } = req.body || {};
  if (!userId) return res.status(400).json({ error: "Missing userId." });

  db.prepare(
    "UPDATE users SET xp = ?, level = ?, atoms = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(xp, level, atoms, userId);

  res.json({ success: true });
});

app.post("/api/user/avatar", (req, res) => {
  const { userId, avatar } = req.body || {};
  if (!userId || !avatar) {
    return res.status(400).json({ error: "Missing userId or avatar." });
  }

  db.prepare(
    "UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(avatar, userId);

  res.json({ success: true });
});

// ---------------------------------------------------------
// Gemini AI chat endpoint for the in-lesson STEMbot assistant
// ---------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { systemContext, beatContext, botName, messages } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured", reply: null });
  }
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const systemInstruction = `${systemContext || ""}\n\nCurrent beat context: ${beatContext || ""}\nRespond as ${botName || "a STEMbot"}.`;
    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: messages,
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini API error:", err);
      return res.status(502).json({ error: "Gemini API error", reply: null });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    res.json({ reply });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ error: "Internal error", reply: null });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`STEMulate Academy API running on http://localhost:${PORT}`);
});
