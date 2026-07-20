<script setup lang="ts">
import type { Task, TaskStatus, TaskPriority } from "~/types";
import { TASK_STATUSES, TASK_PRIORITIES } from "~/types";

const props = defineProps<{
  task?: Task | null;
  projectId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { createTask, updateTask, addSubtask, toggleSubtask, setTaskLabels, fetchActivity } =
  useTasks();
const { members } = useWorkspace();
const { labels } = useLabels();

const form = reactive({
  title: "",
  description: "",
  assignee_id: null as string | null,
  status: "todo" as TaskStatus,
  priority: "medium" as TaskPriority,
  due_date: "",
  start_date: "",
  label_ids: [] as string[],
});

const newSubtask = ref("");
const activity = ref<Awaited<ReturnType<typeof fetchActivity>>>([]);
const saving = ref(false);
const activeTab = ref("details");

const isEdit = computed(() => !!props.task);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;

    if (props.task) {
      form.title = props.task.title;
      form.description = props.task.description ?? "";
      form.assignee_id = props.task.assignee_id;
      form.status = props.task.status;
      form.priority = props.task.priority;
      form.due_date = props.task.due_date ?? "";
      form.start_date = props.task.start_date ?? "";
      form.label_ids =
        props.task.task_labels?.map((tl) => tl.labels?.id).filter(Boolean) as string[] ?? [];
      activity.value = await fetchActivity(props.task.id);
    } else {
      form.title = "";
      form.description = "";
      form.assignee_id = null;
      form.status = "todo";
      form.priority = "medium";
      form.due_date = "";
      form.start_date = "";
      form.label_ids = [];
      activity.value = [];
    }
    activeTab.value = "details";
  },
);

async function save() {
  saving.value = true;

  const payload = {
    title: form.title,
    description: form.description || undefined,
    assignee_id: form.assignee_id || undefined,
    status: form.status,
    priority: form.priority,
    due_date: form.due_date || undefined,
    start_date: form.start_date || undefined,
  };

  if (isEdit.value && props.task) {
    await updateTask(props.task.id, payload);
    await setTaskLabels(props.task.id, form.label_ids);
  } else {
    const { data } = await createTask({ project_id: props.projectId, ...payload });
    if (data && form.label_ids.length) {
      await setTaskLabels(data.id, form.label_ids);
    }
  }

  saving.value = false;
  emit("update:open", false);
  emit("saved");
}

async function handleAddSubtask() {
  if (!props.task || !newSubtask.value.trim()) return;
  await addSubtask(props.task.id, newSubtask.value.trim());
  newSubtask.value = "";
}

const memberOptions = computed(() =>
  members.value.map((m) => ({
    label: m.profiles?.full_name || m.profiles?.email || m.user_id,
    value: m.user_id,
  })),
);

const labelOptions = computed(() =>
  labels.value.map((l) => ({ label: l.name, value: l.id })),
);
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'Edit Task' : 'New Task'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="isEdit" class="mb-4 flex gap-2 border-b border-slate-200 pb-2">
        <UButton
          v-for="tab in ['details', 'comments', 'attachments', 'activity']"
          :key="tab"
          :variant="activeTab === tab ? 'solid' : 'ghost'"
          color="neutral"
          size="xs"
          class="capitalize"
          @click="activeTab = tab"
        >
          {{ tab }}
        </UButton>
      </div>

      <div v-if="activeTab === 'details' || !isEdit" class="space-y-4">
        <UFormField label="Title" required>
          <UInput v-model="form.title" placeholder="Task title" class="w-full" />
        </UFormField>

        <UFormField label="Description">
          <UTextarea v-model="form.description" placeholder="Description..." :rows="3" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Assignee">
            <USelect
              v-model="form.assignee_id"
              :items="[{ label: 'Unassigned', value: null }, ...memberOptions]"
              placeholder="Select assignee"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Status">
            <USelect
              v-model="form.status"
              :items="TASK_STATUSES.map((s) => ({ label: s.label, value: s.value }))"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Priority">
            <USelect
              v-model="form.priority"
              :items="TASK_PRIORITIES.map((p) => ({ label: p.label, value: p.value }))"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Due Date">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Start Date">
            <UInput v-model="form.start_date" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Labels">
            <USelect
              v-model="form.label_ids"
              :items="labelOptions"
              multiple
              placeholder="Select labels"
              class="w-full"
            />
          </UFormField>
        </div>

        <div v-if="isEdit && task?.subtasks" class="space-y-2">
          <p class="text-sm font-medium text-slate-700">Subtasks</p>
          <div v-for="sub in task.subtasks" :key="sub.id" class="flex items-center gap-2">
            <UCheckbox
              :model-value="sub.completed"
              @update:model-value="toggleSubtask(sub.id, $event as boolean)"
            />
            <span :class="sub.completed ? 'line-through text-slate-400' : 'text-slate-700'">
              {{ sub.title }}
            </span>
          </div>
          <div class="flex gap-2">
            <UInput v-model="newSubtask" placeholder="Add subtask..." class="flex-1" @keyup.enter="handleAddSubtask" />
            <UButton size="sm" @click="handleAddSubtask">Add</UButton>
          </div>
        </div>
      </div>

      <TasksTaskComments
        v-else-if="activeTab === 'comments' && task"
        :task-id="task.id"
      />

      <TasksTaskAttachments
        v-else-if="activeTab === 'attachments' && task"
        :task-id="task.id"
      />

      <div v-else-if="activeTab === 'activity'" class="space-y-3">
        <div
          v-for="log in activity"
          :key="log.id"
          class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
        >
          <span class="font-medium">{{ log.profiles?.full_name || log.profiles?.email || "System" }}</span>
          <span class="text-slate-600">
            {{ log.action }}
            <template v-if="log.field_name">
              {{ log.field_name }}: {{ log.old_value }} → {{ log.new_value }}
            </template>
          </span>
          <p class="text-xs text-slate-400">{{ new Date(log.created_at).toLocaleString() }}</p>
        </div>
        <p v-if="activity.length === 0" class="text-sm text-slate-400">No activity yet</p>
      </div>
    </template>

    <template v-if="activeTab === 'details' || !isEdit" #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">Cancel</UButton>
        <UButton :loading="saving" :disabled="!form.title" @click="save">
          {{ isEdit ? "Save" : "Create" }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
