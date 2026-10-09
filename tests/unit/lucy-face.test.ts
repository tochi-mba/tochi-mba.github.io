import { describe, expect, it } from "vitest";
import { announcement, caption, FACE_COLOR, isLive, TRICKS, trickAt } from "../../src/lucyFace";

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
});
