// The team's email for each website sign-up, sent through Resend: which forms
// send one, what it says, and that a failed email never fails the sign-up.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";
import { signupEmail } from "../notify.js";

const SITE = "http://localhost:8000";
const realFetch = globalThis.fetch;
const emails = [];
let resendStatus = 200;
globalThis.fetch = async (url, init) => {
  if (String(url) === "https://api.resend.com/emails") {
    emails.push({ headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(resendStatus === 200 ? { id: "email-1" } : { message: "Invalid `from` field." }), {
      status: resendStatus,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(url, init);
};

let srv;
before(async () => {
  process.env.SIGNUPS_PER_15_MIN = "1000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.SIGNUP_NOTIFY_EMAIL = "team@example.org, janhvi@example.org";
  srv = await startServer();
});
beforeEach(() => {
  emails.length = 0;
  resendStatus = 200;
});
after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.SIGNUP_NOTIFY_EMAIL;
  await srv.close();
});

const send = (body) =>
  realFetch(`${srv.base}/api/site/signup`, {
    method: "POST",
    headers: { origin: SITE, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// The email goes out after the reply, so wait for it.
async function waitForEmails(count) {
  for (let i = 0; i < 50 && emails.length < count; i++) await new Promise((r) => setTimeout(r, 20));
  return emails;
}

test("a volunteer sign-up emails the team, with the volunteer as reply-to", async () => {
  const res = await send({
    kind: "volunteer", name: "Wei Ling", email: "weiling@example.org", school: "Raffles Institution",
    interests: ["workshops", "dev"], message: "I love robotics.",
  });
  assert.equal(res.status, 200);
  const [email] = await waitForEmails(1);
  assert.equal(email.headers.Authorization, "Bearer re_test_key");
  assert.deepEqual(email.body.to, ["team@example.org", "janhvi@example.org"]);
  assert.equal(email.body.from, "Project STEMulate <onboarding@resend.dev>");
  assert.equal(email.body.reply_to, "weiling@example.org");
  assert.equal(email.body.subject, "New volunteer: Wei Ling");
  assert.match(email.body.text, /School: Raffles Institution/);
  assert.match(email.body.text, /Interests: workshops, dev/);
  assert.match(email.body.text, /Message:\nI love robotics\./);
});

test("partner and chapter sign-ups email the team; the newsletter doesn't", async () => {
  await send({ kind: "partner", name: "Mr Lim", email: "lim@centre.sg", organisation: "Sunshine SCC", phone: "+65 6123 4567" });
  await send({ kind: "chapter", name: "Aiko", email: "aiko@example.org", school: "Hillside Secondary" });
  await send({ kind: "newsletter", email: "parent@example.org" });
  await waitForEmails(2);
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(emails.map((e) => e.body.subject), [
    "New partner enquiry: Mr Lim",
    "New chapter application: Aiko",
  ]);
  assert.match(emails[0].body.text, /Organisation: Sunshine SCC\nPhone: \+65 6123 4567/);
});

test("a failed email still counts the sign-up", async () => {
  resendStatus = 403;
  const res = await send({ kind: "volunteer", name: "Ravi", email: "ravi@example.org" });
  assert.equal(res.status, 200);
  await waitForEmails(1);
  assert.equal(emails.length, 1);
});

test("bots caught by the honeypot and refused sign-ups send nothing", async () => {
  await send({ kind: "volunteer", name: "Bot", email: "bot@example.org", website: "spam.example" });
  assert.equal((await send({ kind: "volunteer", name: "", email: "x@example.org" })).status, 400);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(emails.length, 0);
});

test("whatever is typed as a name stays on the subject line", () => {
  const { subject } = signupEmail({ kind: "volunteer", name: "Eve\nBcc: all@example.org", email: "eve@example.org" });
  assert.equal(subject, "New volunteer: Eve Bcc: all@example.org");
});
