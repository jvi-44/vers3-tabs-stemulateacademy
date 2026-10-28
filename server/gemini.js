// Google's Gemini API, used by the Academy's "Ask STEMbots" chat (app.js) and
// the website's assistant (routes/site.js). The keys are GEMINI_API_KEY and,
// for the website only, GEMINI_SITE_API_KEY, on the host (Render >
// stemulate-academy > Environment) and in your own .env; they go in a request
// header, never in the code, a URL or the browser. Read DEPLOY.md "AI chat:
// decide first" before adding one.

// Overridable so the model can be changed without a code edit.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
const THINKING = thinkingFor(GEMINI_MODEL);

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

/**
 * Sends one conversation to Gemini and returns the reply text. Throws a
 * GeminiError: 503 without a key, 502 for an API error or an empty reply
 * (blocked by the safety filters, for example), so nobody gets a blank bubble.
 */
export async function askGemini({ systemInstruction, contents, maxOutputTokens, temperature, apiKey = process.env.GEMINI_API_KEY }) {
  if (!apiKey) throw new GeminiError(503, "GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      // Key goes in a header, never the URL (URLs end up in logs).
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        safetySettings: GEMINI_SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: maxOutputTokens + THINKING.room,
          temperature,
          ...(THINKING.config && { thinkingConfig: THINKING.config }),
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini API error:", res.status, err.slice(0, 500));
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
