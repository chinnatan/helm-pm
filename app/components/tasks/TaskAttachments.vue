<script setup lang="ts">
const props = defineProps<{ taskId: string }>();
const { t } = useI18n();
const taskIdRef = toRef(props, "taskId");
const { attachments, uploadFile, deleteAttachment } = useAttachments(taskIdRef);
const uploading = ref(false);

async function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading.value = true;
  await uploadFile(file);
  uploading.value = false;
  input.value = "";
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="att in attachments"
      :key="att.id"
      class="flex items-center justify-between rounded-lg border border-slate-200 p-3"
    >
      <a :href="att.file_url" target="_blank" class="flex items-center gap-2 text-sm text-blue-600 hover:underline">
        <UIcon name="i-lucide-paperclip" class="h-4 w-4" />
        {{ att.filename }}
      </a>
      <UButton
        icon="i-lucide-trash-2"
        variant="ghost"
        color="error"
        size="xs"
        @click="deleteAttachment(att.id, att.file_url)"
      />
    </div>

    <p v-if="attachments.length === 0" class="text-sm text-slate-400">{{ t("tasks.noAttachments") }}</p>

    <div>
      <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 hover:border-slate-400">
        <UIcon name="i-lucide-upload" class="h-4 w-4" />
        <span>{{ uploading ? t("tasks.uploading") : t("tasks.uploadFile") }}</span>
        <input type="file" class="hidden" :disabled="uploading" @change="onFileSelect" />
      </label>
    </div>
  </div>
</template>
