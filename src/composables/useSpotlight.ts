// A soft signal-coloured light that follows the pointer across a card. Pure CSS variables,
// no re-render; the stylesheet only shows it on fine pointers and ignores it under reduced motion.
export function useSpotlight() {
  function onMove(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }
  function onLeave(event: PointerEvent) {
    const el = event.currentTarget as HTMLElement;
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
  }
  return { onMove, onLeave };
}
