<script setup lang="ts">
const props = defineProps<{ taskId: string }>();
const taskIdRef = toRef(props, "taskId");
const { comments, addComment } = useComments(taskIdRef);
const newComment = ref("");
const sending = ref(false);

async function submit() {
  if (!newComment.value.trim()) return;
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
          {{ new Date(comment.created_at).toLocaleString() }}
        </span>
      </div>
      <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ comment.content }}</p>
    </div>

    <p v-if="comments.length === 0" class="text-sm text-slate-400">No comments yet</p>

    <div class="flex gap-2">
      <UTextarea
        v-model="newComment"
        placeholder="Write a comment... Use @email to mention"
        :rows="2"
        class="flex-1"
      />
      <UButton :loading="sending" :disabled="!newComment.trim()" @click="submit">Send</UButton>
    </div>
  </div>
</template>
