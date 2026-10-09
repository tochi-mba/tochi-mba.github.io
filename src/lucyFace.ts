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
