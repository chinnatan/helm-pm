<script setup lang="ts">
import type { Editor } from "@tiptap/vue-3";

const props = defineProps<{
  editor: Editor;
  variant?: "full" | "minimal";
}>();

const variant = computed(() => props.variant ?? "full");
const isFull = computed(() => variant.value === "full");

/** Bump on selection/transaction so isActive() styles stay in sync. */
const uiTick = ref(0);

function onEditorUi() {
  uiTick.value += 1;
}

onMounted(() => {
  props.editor.on("selectionUpdate", onEditorUi);
  props.editor.on("transaction", onEditorUi);
});

onBeforeUnmount(() => {
  props.editor.off("selectionUpdate", onEditorUi);
  props.editor.off("transaction", onEditorUi);
});

function setLink() {
  const previous = props.editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("URL", previous || "https://");
  if (url === null) return;
  if (url.trim() === "") {
    props.editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  props.editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url.trim() })
    .run();
}

function isActive(name: string, attrs?: Record<string, unknown>) {
  void uiTick.value;
  return props.editor.isActive(name, attrs);
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-1.5 py-1"
  >
    <UButton
      icon="i-lucide-bold"
      size="xs"
      color="neutral"
      :variant="isActive('bold') ? 'soft' : 'ghost'"
      aria-label="Bold"
      @click="editor.chain().focus().toggleBold().run()"
    />
    <UButton
      icon="i-lucide-italic"
      size="xs"
      color="neutral"
      :variant="isActive('italic') ? 'soft' : 'ghost'"
      aria-label="Italic"
      @click="editor.chain().focus().toggleItalic().run()"
    />
    <UButton
      v-if="isFull"
      icon="i-lucide-strikethrough"
      size="xs"
      color="neutral"
      :variant="isActive('strike') ? 'soft' : 'ghost'"
      aria-label="Strike"
      @click="editor.chain().focus().toggleStrike().run()"
    />
    <UButton
      v-if="isFull"
      icon="i-lucide-code"
      size="xs"
      color="neutral"
      :variant="isActive('code') ? 'soft' : 'ghost'"
      aria-label="Code"
      @click="editor.chain().focus().toggleCode().run()"
    />

    <div class="mx-1 h-4 w-px bg-slate-200" />

    <UButton
      v-if="isFull"
      icon="i-lucide-heading-2"
      size="xs"
      color="neutral"
      :variant="isActive('heading', { level: 2 }) ? 'soft' : 'ghost'"
      aria-label="Heading"
      @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
    />
    <UButton
      icon="i-lucide-list"
      size="xs"
      color="neutral"
      :variant="isActive('bulletList') ? 'soft' : 'ghost'"
      aria-label="Bullet list"
      @click="editor.chain().focus().toggleBulletList().run()"
    />
    <UButton
      v-if="isFull"
      icon="i-lucide-list-ordered"
      size="xs"
      color="neutral"
      :variant="isActive('orderedList') ? 'soft' : 'ghost'"
      aria-label="Ordered list"
      @click="editor.chain().focus().toggleOrderedList().run()"
    />
    <UButton
      v-if="isFull"
      icon="i-lucide-quote"
      size="xs"
      color="neutral"
      :variant="isActive('blockquote') ? 'soft' : 'ghost'"
      aria-label="Quote"
      @click="editor.chain().focus().toggleBlockquote().run()"
    />
    <UButton
      v-if="isFull"
      icon="i-lucide-square-code"
      size="xs"
      color="neutral"
      :variant="isActive('codeBlock') ? 'soft' : 'ghost'"
      aria-label="Code block"
      @click="editor.chain().focus().toggleCodeBlock().run()"
    />

    <div class="mx-1 h-4 w-px bg-slate-200" />

    <UButton
      icon="i-lucide-link"
      size="xs"
      color="neutral"
      :variant="isActive('link') ? 'soft' : 'ghost'"
      aria-label="Link"
      @click="setLink"
    />
  </div>
</template>
