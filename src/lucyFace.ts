// Lucy lives in the hero: asleep as a still drawing, awake as the same animated face the LUCY
// client uses (agent-robot-avatar by CX ArtLab, MIT — the face of my LUCY-ui project). Waking her
// is a click, so a page nobody touches schedules no animation frames, which the performance tests
// hold every page to; scrolling her away or hiding the tab puts her back to sleep for the same
// reason. Each further pat plays the next trick in her small repertoire.

/** What a pat plays, in order, round and round. All are actions the face ships. */
export const TRICKS = ["surprise", "love", "random", "inspect", "angry"] as const;
export type Trick = (typeof TRICKS)[number];

export function trickAt(count: number): Trick {
  return TRICKS[((count % TRICKS.length) + TRICKS.length) % TRICKS.length]!;
}

/** The head's colour: ink in both themes, like the drawing she sleeps as. */
export const FACE_COLOR = "#10150f";

/** She is drawn live only while someone woke her, she is on screen, and the tab is shown. */
export function isLive(state: { awake: boolean; inView: boolean; hidden: boolean }): boolean {
  return state.awake && state.inView && !state.hidden;
}

/** The caption under her, which doubles as the button's accessible name. */
export function caption(state: { awake: boolean }): string {
  return state.awake ? "Lucy is awake — pat her for a trick" : "Lucy is asleep — wake her";
}

/** What a screen reader hears when she does something. */
export function announcement(trick: Trick | null): string {
  if (trick === null) return "Lucy woke up. She follows your cursor now.";
  const said: Record<Trick, string> = {
    surprise: "Lucy is surprised.",
    love: "Lucy loves you back.",
    random: "Lucy spins the slots.",
    inspect: "Lucy takes a closer look.",
    angry: "Lucy grumbles.",
  };
  return said[trick];
}

// On her own pages Lucy gets a stage: a bigger face and the moods LUCY-ui shows during a
// conversation, each one a button. The calls are the ones LUCY-ui's face driver makes for the
// same mood, so what a visitor sees here is what a person sees in the app.

/** The moods a visitor can ask for, in the order a conversation passes through them. */
export const MOODS = [
  { id: "thinking", label: "Thinking", says: "Thinking: the request is with her model." },
  { id: "working", label: "Working", says: "Working: the steps of her plan are running." },
  { id: "speaking", label: "Speaking", says: "Speaking: her reply is streaming in." },
  { id: "needs_you", label: "Needs you", says: "Needs you: a step waits for your approval." },
  { id: "done", label: "Done", says: "Done: the turn finished." },
  { id: "failed", label: "Failed", says: "Failed: something broke, and she says so." },
] as const;
export type MoodId = (typeof MOODS)[number]["id"];

/** The part of `<agent-robot-avatar>` a mood uses. */
export interface MoodFace {
  play(action: string): unknown;
  input(active?: boolean): unknown;
  startWaiting(options?: { variant?: "default" | "wrap" }): unknown;
  stopWaiting(): unknown;
}

/** The face's methods may return a promise; one that rejects is an animation cut short. */
function settle(result: unknown): void {
  if (result instanceof Promise) result.catch(() => {});
}

/** Put the face in one mood, ending whatever the last one left running. */
export function showMood(face: MoodFace, mood: MoodId): void {
  settle(face.stopWaiting());
  settle(face.input(false));
  if (mood === "thinking") settle(face.startWaiting());
  else if (mood === "working") settle(face.startWaiting({ variant: "wrap" }));
  else if (mood === "speaking") settle(face.input(true));
  else settle(face.play(mood === "needs_you" ? "warning" : mood === "done" ? "success" : "failure"));
}

/** What the caption under her stage says. */
export function stageCaption(state: { awake: boolean; mood: MoodId | null }): string {
  if (!state.awake) return "Asleep. Pick a mood, or press her face.";
  const mood = MOODS.find((m) => m.id === state.mood);
  return mood ? mood.says : "Awake. Her eyes follow your cursor; press her face for a trick.";
}

/** The pages she has a stage on: the hub and the client that wears her face. */
export const STAGED = new Set(["lucy-assistant", "lucy-ui"]);
