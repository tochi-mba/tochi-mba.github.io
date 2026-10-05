import { type Component, defineAsyncComponent, type HydrationStrategy, hydrateOnIdle } from "vue";

// Parts of a prerendered page that need not be interactive the moment it paints: they are drawn
// with everything else, but hydrated (their listeners attached, their state set up) in an idle
// moment just after, each as a task of its own. The page then becomes usable without one long
// task holding the main thread, and every part is awake within a moment or two of loading.
//
// The component is bundled with the page as before, so moving to the page in the browser renders
// it at once; only the waking is deferred, and only on a page that was prerendered.
//
// While any part is still asleep, <html> carries data-waking with how many; whatever needs the
// whole page interactive (the end-to-end tests do) waits for the attribute to go.

/** How long a part may wait for an idle moment before it is woken regardless. */
export const WAKE_WITHIN_MS = 2000;

/** `strategy`, keeping count on <html data-waking> of the parts it has yet to wake. */
export function counted(strategy: HydrationStrategy): HydrationStrategy {
  return (hydrate, forEachElement) => {
    const root = document.documentElement;
    const asleep = () => Number(root.dataset.waking ?? 0);
    root.dataset.waking = String(asleep() + 1);
    let awake = false;
    const wake = () => {
      if (awake) return;
      awake = true;
      const left = asleep() - 1;
      if (left > 0) root.dataset.waking = String(left);
      else delete root.dataset.waking;
    };
    const stop = strategy(() => {
      hydrate();
      wake();
    }, forEachElement);
    // Unmounted before it woke (the visitor moved on): it no longer counts as asleep.
    return () => {
      stop?.();
      wake();
    };
  };
}

/** `component`, hydrated in an idle moment after the page instead of with it. */
export function wakeLater<T extends Component>(component: T): T {
  return defineAsyncComponent({
    loader: () => Promise.resolve(component),
    hydrate: counted(hydrateOnIdle(WAKE_WITHIN_MS)),
  });
}
