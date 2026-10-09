// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import LucyPeek from "../../src/components/LucyPeek.vue";

function observerSeam() {
  const callbacks: IntersectionObserverCallback[] = [];
  class FakeObserver {
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      callbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return {
    leave: (wrapper: { vm: unknown }) =>
      callbacks[0]?.([{ isIntersecting: false } as IntersectionObserverEntry], wrapper as never),
    arrive: (wrapper: { vm: unknown }) =>
      callbacks[0]?.([{ isIntersecting: true } as IntersectionObserverEntry], wrapper as never),
  };
}

describe("LucyPeek", () => {
  it("sleeps as a still drawing until clicked, then wakes the real face once", async () => {
    const seam = observerSeam();
    try {
      let loads = 0;
      const wrapper = mount(LucyPeek, {
        props: {
          load: () => {
            loads += 1;
            return Promise.resolve({});
          },
        },
      });
      expect(wrapper.find(".lucy-asleep").exists()).toBe(true);
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);
      expect(wrapper.find("button").attributes("aria-label")).toContain("wake her");

      await wrapper.find("button").trigger("click");
      await flushPromises();
      expect(loads).toBe(1);
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
      expect(wrapper.find(".lucy-asleep").exists()).toBe(false);
      expect(wrapper.find("[role=status]").text()).toContain("woke up");
      void seam;
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("pats play her tricks in order, surviving a face that rejects one", async () => {
    observerSeam();
    try {
      const wrapper = mount(LucyPeek, { props: { load: () => Promise.resolve({}) } });
      await wrapper.find("button").trigger("click");
      await flushPromises();
      const played: string[] = [];
      const element = wrapper.find("agent-robot-avatar").element as HTMLElement & { play?: unknown };
      Object.assign(element, {
        play: (action: string) => {
          played.push(action);
          return Promise.reject(new Error("cut short"));
        },
      });
      await wrapper.find("button").trigger("click");
      await wrapper.find("button").trigger("click");
      expect(played).toEqual(["surprise", "love"]);
      expect(wrapper.find("[role=status]").text()).toContain("loves you back");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("goes back to sleep when scrolled away or the tab hides, without forgetting she was woken", async () => {
    const seam = observerSeam();
    try {
      const wrapper = mount(LucyPeek, { props: { load: () => Promise.resolve({}) } });
      await wrapper.find("button").trigger("click");
      await flushPromises();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);

      seam.leave(wrapper);
      await wrapper.vm.$nextTick();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);
      seam.arrive(wrapper);
      await wrapper.vm.$nextTick();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);

      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await wrapper.vm.$nextTick();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(false);
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      await wrapper.vm.$nextTick();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
      wrapper.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("survives a browser with no IntersectionObserver", async () => {
    const kept = globalThis.IntersectionObserver;
    // @ts-expect-error simulating an old browser
    globalThis.IntersectionObserver = undefined;
    try {
      const wrapper = mount(LucyPeek, { props: { load: () => Promise.resolve({}) } });
      await wrapper.find("button").trigger("click");
      await flushPromises();
      expect(wrapper.find("agent-robot-avatar").exists()).toBe(true);
      wrapper.unmount();
    } finally {
      globalThis.IntersectionObserver = kept;
    }
  });
});
