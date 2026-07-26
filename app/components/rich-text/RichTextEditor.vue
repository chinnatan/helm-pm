<script setup lang="ts">
withDefaults(
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

function onUpdate(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <ClientOnly>
    <RichTextEditorInner
      :model-value="modelValue"
      :placeholder="placeholder"
      :variant="variant"
      :rows="rows"
      :disabled="disabled"
      @update:model-value="onUpdate"
    />
    <template #fallback>
      <UTextarea
        :model-value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :disabled="true"
        class="w-full"
      />
    </template>
  </ClientOnly>
</template>
