import { describe, expect, it } from "vitest";
import { level, timeAgo } from "../../src/activity";

describe("timeAgo", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  it.each([
    ["2026-10-01T11:59:50Z", "just now"],
    ["2026-10-01T11:30:00Z", "30 min ago"],
    ["2026-10-01T09:00:00Z", "3 h ago"],
    ["2026-09-28T12:00:00Z", "3 d ago"],
    ["2026-08-01T12:00:00Z", "2 mo ago"],
    ["2024-08-01T12:00:00Z", "2 y ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
  it("never goes negative for a future timestamp", () => {
    expect(timeAgo("2026-10-02T12:00:00Z", now)).toBe("just now");
  });
});

describe("level", () => {
  it("is 0 for no contributions", () => {
    expect(level(0, 10)).toBe(0);
  });
  it("is 4 for the busiest day", () => {
    expect(level(10, 10)).toBe(4);
  });
  it("steps through quartiles", () => {
    expect(level(1, 8)).toBe(1);
    expect(level(3, 8)).toBe(2);
    expect(level(5, 8)).toBe(3);
    expect(level(7, 8)).toBe(4);
  });
  it("copes with a max of zero", () => {
    expect(level(3, 0)).toBe(0);
  });
});
