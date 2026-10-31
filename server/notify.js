// Emails the team when someone signs up on the website (routes/site.js), sent
// through Resend (https://resend.com). The key is RESEND_API_KEY and the inbox
// is SIGNUP_NOTIFY_EMAIL (several, comma-separated), both on the host (Render >
// stemulate-academy > Environment) and in your own .env. Without either,
// nothing is sent and sign-ups still land on the admin page.

// Until projstemulate.com is verified in Resend, onboarding@resend.dev can only
// send to the address the Resend account was made with.
const DEFAULT_FROM = "Project STEMulate <onboarding@resend.dev>";
// Which forms send an email; the newsletter is left out as too noisy.
const DEFAULT_KINDS = "volunteer,partner,chapter";

const TITLES = {
  volunteer: "New volunteer",
  partner: "New partner enquiry",
  chapter: "New chapter application",
  newsletter: "New newsletter sign-up",
};
const LABELS = [
  ["name", "Name"],
  ["email", "Email"],
  ["organisation", "Organisation"],
  ["school", "School"],
  ["phone", "Phone"],
  ["interests", "Interests"],
  ["message", "Message"],
];

const list = (value) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** The email for one sign-up (checked fields from checkSignup): {subject, text}. */
export function signupEmail(fields) {
  const title = TITLES[fields.kind] ?? "New sign-up";
  // One line, so nothing typed can reach the email's headers.
  const who = (fields.name || fields.email).replace(/\s+/g, " ").slice(0, 80);
  const lines = LABELS.filter(([key]) => fields[key]).map(([key, label]) =>
    key === "message" ? `${label}:\n${fields[key]}` : `${label}: ${fields[key]}`,
  );
  return {
    subject: `${title}: ${who}`,
    text: `${title} from the website.\n\n${lines.join("\n")}\n\nIt is also on the admin page under Sign-ups. Reply to this email to answer them.`,
  };
}

/**
 * Sends the team an email about a sign-up. Never throws: a failed email is
 * logged, and the sign-up (already saved) still counts. Returns true if sent.
 */
export async function notifySignup(fields) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = list(process.env.SIGNUP_NOTIFY_EMAIL);
  if (!apiKey || !to.length) return false;
  if (!list(process.env.SIGNUP_NOTIFY_KINDS || DEFAULT_KINDS).includes(fields.kind)) return false;
  const { subject, text } = signupEmail(fields);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.SIGNUP_FROM_EMAIL || DEFAULT_FROM,
        to,
        reply_to: fields.email,
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Resend's error says what's wrong (key, sender, recipient), not who signed up.
      console.error("Sign-up email failed:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Sign-up email failed:", err?.message ?? err);
    return false;
  }
}
