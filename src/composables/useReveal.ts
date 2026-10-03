import { onBeforeUnmount, onMounted } from "vue";

// Marks every .reveal element with data-revealed as it enters the viewport, once. Elements already
// in view on load are revealed on the first frame, so nothing above the fold waits for a scroll.
//
// The mark is an attribute Vue never renders, not a class: a component that changes its own classes
// later (the LUCY map does, when the motion preference changes) has its class list rewritten by
// Vue, and a class added from outside would be dropped with it, hiding the element again.
const REVEALED = "data-revealed";

export function useReveal() {
  let observer: IntersectionObserver | null = null;

  function observe() {
    const targets = document.querySelectorAll<HTMLElement>(`.reveal:not([${REVEALED}])`);
    if (!("IntersectionObserver" in window)) {
      for (const t of targets) t.setAttribute(REVEALED, "");
      return;
    }
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute(REVEALED, "");
          observer?.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    for (const t of targets) observer.observe(t);
  }

  onMounted(observe);
  onBeforeUnmount(() => observer?.disconnect());
  return { refresh: observe };
}
