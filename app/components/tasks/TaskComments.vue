<script setup lang="ts">
const props = defineProps<{ taskId: string }>();
const { t } = useI18n();
const { toLocaleString } = useDateLocale();
const taskIdRef = toRef(props, "taskId");
const { comments, addComment } = useComments(taskIdRef);
const newComment = ref("");
const sending = ref(false);

async function submit() {
  if (isEmptyMarkdown(newComment.value)) return;
  sending.value = true;
  await addComment(newComment.value.trim());
  newComment.value = "";
  sending.value = false;
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="comment in comments" :key="comment.id" class="rounded-lg bg-slate-50 p-3">
      <div class="mb-1 flex items-center gap-2">
        <span class="text-sm font-medium text-slate-800">
          {{ comment.profiles?.full_name || comment.profiles?.email }}
        </span>
        <span class="text-xs text-slate-400">
          {{ toLocaleString(comment.created_at) }}
        </span>
      </div>
      <RichTextContent :content="comment.content" />
    </div>

    <p v-if="comments.length === 0" class="text-sm text-slate-400">{{ t("tasks.noComments") }}</p>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div class="min-w-0 flex-1">
        <RichTextEditor
          v-model="newComment"
          :placeholder="t('tasks.commentPlaceholder')"
          :rows="2"
          variant="minimal"
        />
      </div>
      <UButton
        :loading="sending"
        :disabled="isEmptyMarkdown(newComment)"
        class="shrink-0"
        @click="submit"
      >
        {{ t("common.send") }}
      </UButton>
    </div>
  </div>
</template>
