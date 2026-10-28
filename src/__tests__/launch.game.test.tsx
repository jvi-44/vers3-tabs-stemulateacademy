// @vitest-environment jsdom
// Solar Escape tells screen readers what happened: the result of each launch,
// the tries left and the next launch (not only in the helper's speech bubble).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../games/kit/audio", () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
import { ThrustEscape } from "../episodes/minigames/ThrustEscape";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });

it("reads out each launch's result, the tries left and the next launch", async () => {
  vi.useFakeTimers();
  render(<ThrustEscape onDone={() => {}} helper="emily" band="p34" />);
  fireEvent.click(screen.getByRole("button", { name: "I'm ready!" }));
  for (let i = 0; i < 4; i += 1) await wait(700);
  const said = () => screen.getByRole("status").textContent;
  expect(said()).toMatch(/^Launch 1 of 3\. Thrust must beat the pull/);

  // Thrust 1 never beats the pull: the ship sinks, and there's one more try.
  fireEvent.click(screen.getByRole("button", { name: /Fire/ }));
  expect(said()).toMatch(/is less than/);
  await wait(1600);
  expect(said()).toBe("Try 2 of 2.");

  // Out of tries: Emily boosts the engines, then the next launch starts.
  fireEvent.click(screen.getByRole("button", { name: /Fire/ }));
  await wait(1600);
  expect(said()).toMatch(/^Emily set thrust to \d+, just more than \d+\. Launch 2 of 3\. Set the power, then fire\.$/);
});
