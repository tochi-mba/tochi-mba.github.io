// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, type HydrationStrategy } from "vue";
import { counted, WAKE_WITHIN_MS, wakeLater } from "../../src/wakeLater";

/** A strategy that wakes only when the test says so, and remembers whether it was stopped. */
function byHand() {
  const parts: { wake: () => void; stopped: boolean }[] = [];
  const strategy: HydrationStrategy = (hydrate) => {
    const part = { wake: hydrate, stopped: false };
    parts.push(part);
    return () => {
      part.stopped = true;
    };
  };
  return { strategy, parts };
}
const waking = () => document.documentElement.dataset.waking;

afterEach(() => {
  delete document.documentElement.dataset.waking;
});

describe("waking parts of a page later", () => {
  it("counts the parts still asleep on <html>, and clears the count when the last wakes", () => {
    const { strategy, parts } = byHand();
    const hydrated: string[] = [];
    counted(strategy)(
      () => hydrated.push("a"),
      () => {},
    );
    counted(strategy)(
      () => hydrated.push("b"),
      () => {},
    );
    expect(waking()).toBe("2");
    parts[0]!.wake();
    expect(waking()).toBe("1");
    parts[1]!.wake();
    expect(waking()).toBeUndefined();
    expect(hydrated).toEqual(["a", "b"]);
  });
  it("stops counting a part that is unmounted before it wakes, and stops its strategy", () => {
    const { strategy, parts } = byHand();
    const teardown = counted(strategy)(
      () => {},
      () => {},
    ) as () => void;
    expect(waking()).toBe("1");
    teardown();
    expect(parts[0]!.stopped).toBe(true);
    expect(waking()).toBeUndefined();
  });
  it("counts a part once, however often it is woken or torn down", () => {
    const { strategy, parts } = byHand();
    counted(strategy)(
      () => {},
      () => {},
    );
    const teardown = counted(strategy)(
      () => {},
      () => {},
    ) as () => void;
    parts[1]!.wake();
    teardown();
    parts[1]!.wake();
    expect(waking()).toBe("1");
  });
  it("copes with a strategy that returns nothing to stop", () => {
    const teardown = counted(() => undefined)(
      () => {},
      () => {},
    ) as () => void;
    expect(() => teardown()).not.toThrow();
    expect(waking()).toBeUndefined();
  });
  it("gives back an async component that resolves to the component itself, woken within two seconds", async () => {
    const Part = defineComponent({ name: "Part", render: () => null });
    const Later = wakeLater(Part) as unknown as { __asyncLoader: () => Promise<unknown>; name: string };
    expect(WAKE_WITHIN_MS).toBe(2000);
    expect(Later.name).toBe("AsyncComponentWrapper");
    await expect(Later.__asyncLoader()).resolves.toBe(Part);
  });
});
