<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{ value: number; suffix?: string }>();
const el = ref<HTMLElement | null>(null);
const shown = ref(props.value);
let raf = 0;

onMounted(() => {
  if (!document.documentElement.classList.contains("motion") || !("IntersectionObserver" in window)) return;
  shown.value = 0;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return;
    io.disconnect();
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      shown.value = Math.round(props.value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  if (el.value) io.observe(el.value);
});
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <strong ref="el"><span aria-hidden="true">{{ shown }}{{ suffix ?? "" }}</span><span class="sr-only">{{ value }}{{ suffix ?? "" }}</span></strong>
</template>
