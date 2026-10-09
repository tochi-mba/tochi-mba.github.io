import { describe, expect, it } from "vitest";
import {
  announcement,
  caption,
  FACE_COLOR,
  isLive,
  MOODS,
  type MoodFace,
  STAGED,
  showMood,
  stageCaption,
  TRICKS,
  trickAt,
} from "../../src/lucyFace";

describe("Lucy in the hero", () => {
  it("cycles her tricks in order, round and round, whatever the count", () => {
    expect(TRICKS.map((_, i) => trickAt(i))).toEqual([...TRICKS]);
    expect(trickAt(TRICKS.length)).toBe(TRICKS[0]);
    expect(trickAt(-1)).toBe(TRICKS[TRICKS.length - 1]);
  });

  it("is drawn live only while woken, on screen, and in a shown tab", () => {
    expect(isLive({ awake: true, inView: true, hidden: false })).toBe(true);
    expect(isLive({ awake: false, inView: true, hidden: false })).toBe(false);
    expect(isLive({ awake: true, inView: false, hidden: false })).toBe(false);
    expect(isLive({ awake: true, inView: true, hidden: true })).toBe(false);
  });

  it("names the button for what a click does", () => {
    expect(caption({ awake: false })).toContain("wake her");
    expect(caption({ awake: true })).toContain("pat her");
  });

  it("has a sentence for waking and for every trick", () => {
    expect(announcement(null)).toContain("woke up");
    for (const trick of TRICKS) {
      expect(announcement(trick)).toMatch(/^Lucy /);
    }
  });

  it("keeps her head ink-dark, which reads in both themes", () => {
    expect(FACE_COLOR).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("drives each mood with the same calls LUCY-ui's face driver makes, ending the last one first", () => {
    const calls: string[] = [];
    const face: MoodFace = {
      play: (action) => calls.push(`play:${action}`),
      input: (active) => calls.push(`input:${active}`),
      startWaiting: (options) => calls.push(`wait:${options?.variant ?? "default"}`),
      stopWaiting: () => calls.push("stop"),
    };
    const seen: Record<string, string> = {};
    for (const mood of MOODS) {
      calls.length = 0;
      showMood(face, mood.id);
      expect(calls.slice(0, 2)).toEqual(["stop", "input:false"]);
      seen[mood.id] = calls[2]!;
    }
    expect(seen).toEqual({
      thinking: "wait:default",
      working: "wait:wrap",
      speaking: "input:true",
      needs_you: "play:warning",
      done: "play:success",
      failed: "play:failure",
    });
  });

  it("lets a face whose animation is cut short reject without an unhandled error", async () => {
    const rejected = () => Promise.reject(new Error("cut short"));
    const face: MoodFace = { play: rejected, input: rejected, startWaiting: rejected, stopWaiting: rejected };
    showMood(face, "done");
    await Promise.resolve();
  });

  it("captions the stage asleep, awake, and in each mood", () => {
    expect(stageCaption({ awake: false, mood: null })).toContain("Asleep");
    expect(stageCaption({ awake: true, mood: null })).toContain("follow your cursor");
    for (const mood of MOODS) expect(stageCaption({ awake: true, mood: mood.id })).toBe(mood.says);
  });

  it("puts her on stage on her own pages only", () => {
    expect(STAGED.has("lucy-assistant")).toBe(true);
    expect(STAGED.has("lucy-ui")).toBe(true);
    expect(STAGED.has("weftai")).toBe(false);
  });
});
