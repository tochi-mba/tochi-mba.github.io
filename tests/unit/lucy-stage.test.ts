// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import LucyStage from "../../src/components/LucyStage.vue";

// A stand-in for agent-robot-avatar that records what the stage asks of it.
const calls: string[] = [];
class FakeFace extends HTMLElement {
  play(action: string) {
    calls.push(`play:${action}`);
    return Promise.reject(new Error("cut short"));
  }
  input(active?: boolean) {
    calls.push(`input:${active}`);
  }
  startWaiting(options?: { variant?: string }) {
    calls.push(`wait:${options?.variant ?? "default"}`);
  }
  stopWaiting() {
    calls.push("stop");
  }
}

function observerSeam() {
  const callbacks: IntersectionObserverCallback[] = [];
  class FakeObserver {
    constructor(callback: IntersectionObserverCallback) {
      callbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  const fire = (isIntersecting: boolean) =>
    callbacks[0]?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  return { leave: () => fire(false), arrive: () => fire(true) };
}

function narrowScreen(matches: boolean) {
  const listeners: (() => void)[] = [];
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    query,
    change(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

const define = () => {
  if (!customElements.get("agent-robot-avatar")) customElements.define("agent-robot-avatar", FakeFace);
  return Promise.resolve({});
};

afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});

describe("LucyStage", () => {
  // First, while no definition is registered: the registry outlives a test, so later tests
  // that define the fake face would upgrade this one too.
  it("does not drive a face whose definition never upgraded it", async () => {
    observerSeam();
    const wrapper = mount(LucyStage, { props: { load: () => Promise.resolve({}) } });
    // Rendered as an unknown element: present, but without the face's methods.
    await wrapper.findAll(".lucy-stage-mood")[3]!.trigger("click");
    await flushPromises();
    await wrapper.findAll(".lucy-stage-mood")[5]!.trigger("click");
    await flushPromises();
    expect(calls).toEqual([]);
    expect(wrapper.find(".lucy-stage-mood[aria-pressed=true]").text()).toBe("Failed");
    wrapper.unmount();
  });

  it("sleeps as a still drawing with every mood offered, and loads nothing until asked", () => {
    observerSeam();
    const load = vi.fn(define);
    const wrapper = mount(LucyStage, { props: { load } });
    expect(wrapper.find(".lucy-stage-asleep").exists()).toBe(true);
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);
    expect(wrapper.findAll(".lucy-stage-mood").map((b) => b.text())).toEqual([
      "Thinking",
      "Working",
      "Speaking",
      "Needs you",
      "Done",
      "Failed",
    ]);
    expect(wrapper.find(".lucy-stage-line").text()).toContain("Asleep");
    expect(load).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("wakes in the mood that was picked, then moves between moods on the face already there", async () => {
    observerSeam();
    const load = vi.fn(define);
    const wrapper = mount(LucyStage, { props: { load }, attachTo: document.body });
    await wrapper.findAll(".lucy-stage-mood")[0]!.trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
    expect(calls).toEqual(["stop", "input:false", "wait:default"]);
    expect(wrapper.find(".lucy-stage-mood[aria-pressed=true]").text()).toBe("Thinking");
    expect(wrapper.find("[role=status]").text()).toContain("Thinking");

    calls.length = 0;
    await wrapper.findAll(".lucy-stage-mood")[4]!.trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["stop", "input:false", "play:success"]);
    expect(wrapper.find(".lucy-stage").attributes("data-mood")).toBe("done");
    expect(wrapper.find(".lucy-stage-line").text()).toContain("the turn finished");
    wrapper.unmount();
  });

  it("wakes on her face, then a pat plays a trick and leaves the mood", async () => {
    observerSeam();
    const wrapper = mount(LucyStage, { props: { load: define }, attachTo: document.body });
    await wrapper.find(".lucy-stage-face").trigger("click");
    await flushPromises();
    expect(wrapper.find("[role=status]").text()).toContain("woke up");
    expect(wrapper.find(".lucy-stage-line").text()).toContain("follow your cursor");

    await wrapper.findAll(".lucy-stage-mood")[2]!.trigger("click");
    await flushPromises();
    calls.length = 0;
    await wrapper.find(".lucy-stage-face").trigger("click");
    expect(calls).toEqual(["play:surprise"]);
    expect(wrapper.find(".lucy-stage-mood[aria-pressed=true]").exists()).toBe(false);
    wrapper.unmount();
  });

  it("sleeps out of view and wakes back into the mood she was in", async () => {
    const seam = observerSeam();
    const wrapper = mount(LucyStage, { props: { load: define }, attachTo: document.body });
    await wrapper.findAll(".lucy-stage-mood")[1]!.trigger("click");
    await flushPromises();
    seam.leave();
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);

    calls.length = 0;
    seam.arrive();
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
    expect(calls).toEqual(["stop", "input:false", "wait:wrap"]);

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    wrapper.unmount();
  });

  it("sizes the face for the screen it is on", async () => {
    observerSeam();
    const screen = narrowScreen(true);
    const wrapper = mount(LucyStage, { props: { load: define }, attachTo: document.body });
    await wrapper.find(".lucy-stage-face").trigger("click");
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").attributes("size")).toBe("148");
    screen.change(false);
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").attributes("size")).toBe("200");
    wrapper.unmount();
    expect(screen.query.removeEventListener).toHaveBeenCalled();
  });

  it("survives a browser with no IntersectionObserver and no matchMedia", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.stubGlobal("matchMedia", undefined);
    const wrapper = mount(LucyStage, { props: { load: define } });
    await wrapper.find(".lucy-stage-face").trigger("click");
    await flushPromises();
    expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
    wrapper.unmount();
  });
});
