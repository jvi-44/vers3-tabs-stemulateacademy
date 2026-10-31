// Google's Gemini API, used by the Academy's "Ask STEMbots" chat (app.js) and
// the website's assistant (routes/site.js). The keys are GEMINI_API_KEY (or
// GEMINI_API, the name used on Render) and, for the website only,
// GEMINI_SITE_API_KEY, on the host (Render >
// stemulate-academy > Environment) and in your own .env; they go in a request
// header, never in the code, a URL or the browser. Read DEPLOY.md "AI chat:
// decide first" before adding one.

// Overridable so the model can be changed without a code edit.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Tried when the main model is out of quota or overloaded; Flash-Lite has its
// own, larger free quota. GEMINI_FALLBACK_MODEL=off turns this off.
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
// After a 429, a model is skipped for this long so a busy class doesn't keep
// hitting a quota that is already used up.
const QUOTA_COOLDOWN_MS = 60_000;

/** The Academy's Gemini key: GEMINI_API_KEY, or GEMINI_API as it is named on Render. */
export function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_API || "";
}

/**
 * How much the model may "think" before answering. Thinking tokens come out of
 * maxOutputTokens, which can leave a short reply cut off or empty, and these
 * chats don't need it. Gemini 2.5 Flash and Flash-Lite can switch it off; 2.5
 * Pro and Gemini 3 and later can only turn it down, so they also get room for
 * it on top of the reply, as do models this doesn't know.
 */
export function thinkingFor(model) {
  if (/^gemini-2\.5-flash/.test(model)) return { config: { thinkingBudget: 0 }, room: 0 };
  if (/^gemini-2\.5-pro/.test(model)) return { config: { thinkingBudget: 128 }, room: 256 };
  if (/^gemini-([3-9]|[1-9]\d)/.test(model)) return { config: { thinkingLevel: "low" }, room: 1024 };
  return { config: null, room: 1024 };
}

export const GEMINI_SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_LOW_AND_ABOVE" }));

/** A failed Gemini call, with the HTTP status the route should answer with. */
export class GeminiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Validates a chat history sent by a browser ({role: "user" | "model",
 * parts: [{text}]}, the shape Gemini uses) and returns the last `maxMessages`
 * as Gemini `contents`, or null if anything is off. The person's turns may be
 * up to `maxChars` long; the model's earlier replies, sent back as context,
 * up to `maxModelChars`.
 */
export function geminiContents(messages, { maxMessages, maxChars, maxModelChars = maxChars }) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const recent = messages.slice(-maxMessages);
  const contents = [];
  for (const m of recent) {
    if (!m || (m.role !== "user" && m.role !== "model")) return null;
    if (!Array.isArray(m.parts) || m.parts.length !== 1) return null;
    const text = m.parts[0]?.text;
    const max = m.role === "model" ? maxModelChars : maxChars;
    if (typeof text !== "string" || !text.trim() || text.length > max) return null;
    contents.push({ role: m.role, parts: [{ text }] });
  }
  // Gemini expects the conversation to start with, and end on, the person asking.
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user") return null;
  return contents;
}

// Model name -> time its quota cooldown ends.
const limitedUntil = new Map();

/** For tests: forget every quota cooldown. */
export function resetGeminiCooldowns() {
  limitedUntil.clear();
}

/**
 * Sends one conversation to Gemini and returns the reply text. If the main
 * model is out of quota (429) or overloaded (503), the fallback model gets one
 * try. Throws a GeminiError: 503 without a key, 429 when every model is out of
 * quota, 502 for an API error or an empty reply (blocked by the safety
 * filters, for example), so nobody gets a blank bubble.
 */
export async function askGemini({ systemInstruction, contents, maxOutputTokens, temperature, apiKey = geminiApiKey() }) {
  if (!apiKey) throw new GeminiError(503, "GEMINI_API_KEY not configured");

  const models = [GEMINI_MODEL];
  if (GEMINI_FALLBACK_MODEL !== "off" && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) models.push(GEMINI_FALLBACK_MODEL);
  let lastError = new GeminiError(429, "Gemini quota reached");
  for (const model of models) {
    if ((limitedUntil.get(model) ?? 0) > Date.now()) continue;
    try {
      return await askModel(model, { systemInstruction, contents, maxOutputTokens, temperature, apiKey });
    } catch (err) {
      if (!(err instanceof GeminiError) || (err.status !== 429 && err.status !== 503)) throw err;
      if (err.status === 429) limitedUntil.set(model, Date.now() + QUOTA_COOLDOWN_MS);
      lastError = err;
    }
  }
  throw lastError;
}

async function askModel(model, { systemInstruction, contents, maxOutputTokens, temperature, apiKey }) {
  const thinking = thinkingFor(model);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      // Key goes in a header, never the URL (URLs end up in logs).
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        safetySettings: GEMINI_SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: maxOutputTokens + thinking.room,
          temperature,
          ...(thinking.config && { thinkingConfig: thinking.config }),
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`Gemini API error (${model}):`, res.status, err.slice(0, 500));
    if (res.status === 429) throw new GeminiError(429, "Gemini quota reached");
    // 503 here is Google's "model overloaded", not our missing-key 503.
    if (res.status === 503) throw new GeminiError(503, "Gemini overloaded");
    throw new GeminiError(502, "Gemini API error");
  }
  const data = await res.json();
  const reply = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!reply) {
    // Why, without what was asked: a safety block, the length cap, thinking...
    const why = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? "unknown";
    console.warn(`Gemini gave no text (${why}; ${data?.usageMetadata?.thoughtsTokenCount ?? 0} thinking tokens).`);
    throw new GeminiError(502, "Empty reply");
  }
  return reply;
}
