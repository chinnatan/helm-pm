<script setup lang="ts">
const { t } = useI18n();

const props = defineProps<{
  content?: string | null;
  class?: string;
  clampLines?: number;
}>();

const html = ref("");
const expanded = ref(false);
const isClamped = ref(false);
const contentRef = ref<HTMLElement | null>(null);

async function refresh() {
  html.value = await renderMarkdownToSafeHtml(props.content);
}

function measureOverflow() {
  const el = contentRef.value;
  if (!el || !props.clampLines) {
    isClamped.value = false;
    return;
  }
  nextTick(() => {
    const el2 = contentRef.value;
    if (!el2) return;
    isClamped.value = el2.scrollHeight > el2.clientHeight + 1;
  });
}

onMounted(() => {
  refresh();
});

watch(
  () => props.content,
  () => {
    if (import.meta.client) refresh();
  },
);

watch(html, () => {
  if (props.clampLines && !expanded.value) {
    nextTick(measureOverflow);
  }
});

watch(expanded, (val) => {
  if (!val) {
    nextTick(measureOverflow);
  }
});

const CLAMP_CLASSES: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

const clampClass = computed(() => {
  if (!props.clampLines || expanded.value) return "";
  return CLAMP_CLASSES[props.clampLines] ?? "line-clamp-5";
});

const preview = computed(() => stripMarkdownForPreview(props.content));
</script>

<template>
  <div>
    <ClientOnly>
      <div
        v-if="html"
        ref="contentRef"
        class="rich-text-content text-sm text-slate-700"
        :class="[props.class, clampClass]"
        v-html="html"
      />
      <template #fallback>
        <p
          v-if="preview"
          class="text-sm text-slate-700 whitespace-pre-wrap"
          :class="props.class"
        >
          {{ preview }}
        </p>
      </template>
    </ClientOnly>
    <button
      v-if="clampLines && (isClamped || expanded)"
      class="mt-1 text-xs font-medium text-ocean-700 hover:text-ocean-900 hover:underline"
      @click="expanded = !expanded"
    >
      {{ expanded ? t("common.showLess") : t("common.showMore") }}
    </button>
  </div>
</template>

<style>
.rich-text-content p {
  margin: 0.25rem 0;
}

.rich-text-content p:first-child {
  margin-top: 0;
}

.rich-text-content p:last-child {
  margin-bottom: 0;
}

.rich-text-content h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}

.rich-text-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}

.rich-text-content ul {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.rich-text-content ol {
  list-style: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.rich-text-content blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 0.75rem;
  color: #64748b;
  margin: 0.35rem 0;
}

.rich-text-content code {
  font-size: 0.875em;
  background: #f1f5f9;
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}

.rich-text-content pre {
  background: #f1f5f9;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  overflow-x: auto;
  margin: 0.35rem 0;
}

.rich-text-content pre code {
  background: transparent;
  padding: 0;
}

.rich-text-content a {
  color: #0b6e7a;
  text-decoration: underline;
}

.rich-text-content img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin: 0.5rem 0;
  display: block;
}

.rich-text-content strong {
  font-weight: 600;
}
</style>
