import { onBeforeUnmount, onMounted } from "vue";

// Adds .visible to every .reveal element as it enters the viewport, once. Elements already in
// view on load are revealed on the first frame, so nothing above the fold waits for a scroll.
export function useReveal() {
  let observer: IntersectionObserver | null = null;

  function observe() {
    const targets = document.querySelectorAll<HTMLElement>(".reveal:not(.visible)");
    if (!("IntersectionObserver" in window)) {
      for (const t of targets) t.classList.add("visible");
      return;
    }
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("visible");
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
