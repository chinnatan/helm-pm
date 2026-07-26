<script setup lang="ts">
const props = defineProps<{
  content?: string | null;
  class?: string;
}>();

const html = ref("");

async function refresh() {
  html.value = await renderMarkdownToSafeHtml(props.content);
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

const preview = computed(() => stripMarkdownForPreview(props.content));
</script>

<template>
  <ClientOnly>
    <div
      v-if="html"
      class="rich-text-content text-sm text-slate-700"
      :class="props.class"
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

.rich-text-content strong {
  font-weight: 600;
}
</style>
