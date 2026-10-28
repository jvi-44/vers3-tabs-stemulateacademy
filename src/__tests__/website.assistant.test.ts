// @vitest-environment jsdom
// The website's "Ask us" widget (website/assistant.js), run as the page runs
// it: its own long answers go back cut to what the server takes, a
// conversation the server couldn't use starts again, an emoji isn't cut in
// half, and a question typed while it's busy waits in the box.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import widget from "../../website/assistant.js?raw";
import siteRoutes from "../../server/routes/site.js?raw";

type Sent = { messages: { role: string; parts: { text: string }[] }[] };
let sent: Sent[];
let replies: { status: number; body: unknown }[];

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const input = () => document.getElementById("ask-input") as HTMLTextAreaElement;
const form = () => document.querySelector(".ask-form") as HTMLFormElement;
async function ask(text: string) {
  input().value = text;
  form().dispatchEvent(new Event("submit", { cancelable: true }));
  await flush();
}
const texts = (i: number) => sent[i].messages.map((m) => m.parts[0].text);

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  sent = [];
  replies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      const { status, body } = replies.shift() ?? { status: 200, body: { reply: "ok" } };
      return new Response(JSON.stringify(body), { status });
    }),
  );
  HTMLFormElement.prototype.requestSubmit ||= function (this: HTMLFormElement) {
    this.dispatchEvent(new Event("submit", { cancelable: true }));
  };
  new Function(widget)();
});
afterEach(() => vi.unstubAllGlobals());

describe("the Ask us widget", () => {
  it("allows what the server allows", () => {
    const num = (src: string, name: string) => Number(new RegExp(`const ${name} = (\\d+);`).exec(src)?.[1]);
    const widgetLimits = [num(widget, "MAX_REPLY_CHARS"), num(widget, "MAX_CHARS")];
    const serverLimits = [num(siteRoutes, "ASSISTANT_MAX_REPLY_CHARS"), num(siteRoutes, "ASSISTANT_MAX_CHARS")];
    expect([...widgetLimits, ...serverLimits].every(Number.isFinite)).toBe(true);
    expect(widgetLimits).toEqual(serverLimits);
  });

  it("sends its own long answers back cut to 2000 characters, never half an emoji", async () => {
    replies.push({ status: 200, body: { reply: "a".repeat(2500) } }, { status: 200, body: { reply: "a".repeat(1999) + "😀b" } });
    await ask("first");
    await ask("second");
    expect(texts(1)[1]).toHaveLength(2000);
    await ask("third");
    expect(texts(2)[3]).toBe("a".repeat(1999));
  });

  it("starts a fresh conversation after one the server refused, but not after 'slow down'", async () => {
    replies.push(
      { status: 200, body: { reply: "one" } },
      { status: 502, body: { error: "The assistant is unavailable right now." } },
      { status: 200, body: { reply: "two" } },
      { status: 429, body: { error: "That's a lot of questions! Please wait a minute." } },
    );
    await ask("q1");
    await ask("q2");
    await ask("q3");
    expect(texts(2)).toEqual(["q3"]);
    await ask("q4");
    await ask("q5");
    expect(texts(4)).toEqual(["q3", "two", "q5"]);
  });

  it("keeps a question typed while an answer is on its way", async () => {
    let release = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            release = () => done(new Response(JSON.stringify({ reply: "hi" }), { status: 200 }));
          }),
      ),
    );
    await ask("first");
    input().value = "second";
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(input().value).toBe("second");
    release();
    await flush();
    expect(input().value).toBe("second");
  });
});
