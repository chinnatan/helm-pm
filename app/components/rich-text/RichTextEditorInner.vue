<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    variant?: "full" | "minimal";
    rows?: number;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    placeholder: "",
    variant: "full",
    rows: 3,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { uploadEditorImage } = useEditorImageUpload();
const uploadingImage = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const minHeight = computed(() => `${Math.max(props.rows, 2) * 1.5 + 1}rem`);

async function insertImageFromFile(file: File) {
  if (!editor.value || props.disabled || props.variant !== "full") return;
  if (!file.type.startsWith("image/")) return;

  uploadingImage.value = true;
  try {
    const { url, error } = await uploadEditorImage(file);
    if (error || !url) {
      console.warn("editor image upload failed:", error);
      return;
    }
    editor.value.chain().focus().setImage({ src: url }).run();
  } finally {
    uploadingImage.value = false;
  }
}

function openImagePicker() {
  fileInputRef.value?.click();
}

function onImageFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) void insertImageFromFile(file);
}

const editor = useEditor({
  content: props.modelValue || "",
  contentType: "markdown",
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: props.variant === "minimal" ? false : { levels: [2, 3] },
      codeBlock: props.variant === "minimal" ? false : undefined,
      blockquote: props.variant === "minimal" ? false : undefined,
      horizontalRule: props.variant === "minimal" ? false : undefined,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Markdown,
  ],
  editorProps: {
    attributes: {
      class: "rich-text-prose focus:outline-none px-3 py-2",
    },
    handlePaste: (_view, event) => {
      if (props.variant !== "full" || props.disabled) return false;
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void insertImageFromFile(file);
            return true;
          }
        }
      }
      return false;
    },
    handleDrop: (_view, event) => {
      if (props.variant !== "full" || props.disabled) return false;
      const files = event.dataTransfer?.files;
      if (!files?.length) return false;
      const image = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (!image) return false;
      event.preventDefault();
      void insertImageFromFile(image);
      return true;
    },
  },
  onUpdate: ({ editor: ed }) => {
    const md = ed.getMarkdown().trim();
    emit("update:modelValue", md);
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const current = editor.value.getMarkdown().trim();
    const next = (value ?? "").trim();
    if (current === next) return;
    editor.value.commands.setContent(value || "", {
      contentType: "markdown",
      emitUpdate: false,
    });
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled);
  },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div
    class="w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs transition-colors focus-within:border-ocean-700 focus-within:ring-2 focus-within:ring-ocean-700/20"
    :class="{ 'pointer-events-none opacity-60': disabled }"
  >
    <RichTextToolbar
      v-if="editor && !disabled"
      :editor="editor"
      :variant="variant"
      :uploading-image="uploadingImage"
      @insert-image="openImagePicker"
    />
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="onImageFileChange"
    />
    <div class="overflow-y-auto" :style="{ minHeight }">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style>
.rich-text-prose {
  min-height: inherit;
}

.rich-text-prose p {
  margin: 0.25rem 0;
}

.rich-text-prose h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}

.rich-text-prose h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
}

.rich-text-prose ul {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.rich-text-prose ol {
  list-style: decimal;
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}

.rich-text-prose blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 0.75rem;
  color: #64748b;
  margin: 0.35rem 0;
}

.rich-text-prose code {
  font-size: 0.875em;
  background: #f1f5f9;
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}

.rich-text-prose pre {
  background: #f1f5f9;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  overflow-x: auto;
  margin: 0.35rem 0;
}

.rich-text-prose pre code {
  background: transparent;
  padding: 0;
}

.rich-text-prose a {
  color: #0b6e7a;
  text-decoration: underline;
}

.rich-text-prose img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin: 0.5rem 0;
  display: block;
}

.rich-text-prose p.is-editor-empty:first-child::before {
  color: #94a3b8;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
