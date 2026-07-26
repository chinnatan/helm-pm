<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src?: string | null;
    name?: string | null;
    email?: string | null;
    size?: "xs" | "sm" | "md";
    tone?: "neutral" | "amber";
  }>(),
  {
    src: null,
    name: null,
    email: null,
    size: "xs",
    tone: "neutral",
  },
);

const initial = computed(
  () => (props.name || props.email)?.[0]?.toUpperCase() ?? "?",
);

const sizeClass = computed(() => {
  if (props.size === "md") return "h-10 w-10 text-sm";
  if (props.size === "sm") return "h-7 w-7 text-xs";
  return "h-5 w-5 text-[10px]";
});

const toneClass = computed(() =>
  props.tone === "amber"
    ? "bg-amber-100 text-amber-700"
    : "bg-slate-200 text-slate-600",
);
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium"
    :class="[sizeClass, toneClass]"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="h-full w-full object-cover"
    >
    <span v-else>{{ initial }}</span>
  </div>
</template>
