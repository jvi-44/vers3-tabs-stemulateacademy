// Choices made in the interactive intro episodes (see server/routes/story.js).
import { request } from "./client";
import type { Flags } from "../episodes/types";

export function getStoryChoices(): Promise<{ choices: Record<string, Flags> }> {
  return request("/story");
}

export function saveStoryChoices(beatId: string, choices: Flags): Promise<{ success: true; choices: Flags }> {
  return request(`/story/${encodeURIComponent(beatId)}`, { method: "PUT", body: JSON.stringify({ choices }) });
}
