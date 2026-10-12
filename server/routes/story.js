import express from "express";
import db from "../db.js";
import { requireUser } from "../auth.js";

// Choices made in the interactive intro episodes (src/episodes). Each episode
// saves a small map of flags, e.g. { buddy: "emily", style: "curious" }, so a
// later episode can say "Partners again, just like in the biome!".

const router = express.Router();
router.use("/story", requireUser);

// The intro beats that have an episode.
const EPISODE_BEATS = new Set(["mm-intro", "mi-intro", "sb-intro"]);
const MAX_FLAGS = 30;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

/** Keeps only short, flat string/number/boolean flags; null if it isn't a flag map. */
function cleanFlags(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input);
  if (entries.length > MAX_FLAGS) return null;
  const out = {};
  for (const [k, v] of entries) {
    if (!KEY.test(k)) return null;
    if (typeof v === "string" && v.length <= 32) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else return null;
  }
  return out;
}

router.get("/story", (req, res) => {
  const rows = db.prepare("SELECT beat_id, choices FROM story_choices WHERE user_id = ?").all(req.userId);
  const choices = {};
  for (const r of rows) {
    try {
      choices[r.beat_id] = JSON.parse(r.choices);
    } catch {
      // A damaged row is just skipped.
    }
  }
  res.json({ choices });
});

router.put("/story/:beatId", (req, res) => {
  const { beatId } = req.params;
  if (!EPISODE_BEATS.has(beatId)) return res.status(400).json({ error: "Unknown episode." });
  const flags = cleanFlags(req.body?.choices);
  if (!flags) return res.status(400).json({ error: "Choices must be a small map of simple values." });
  db.prepare(
    `INSERT INTO story_choices (user_id, beat_id, choices, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, beat_id) DO UPDATE SET choices = excluded.choices, updated_at = CURRENT_TIMESTAMP`,
  ).run(req.userId, beatId, JSON.stringify(flags));
  res.json({ success: true, choices: flags });
});

export default router;
