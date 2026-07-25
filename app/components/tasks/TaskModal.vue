<script setup lang="ts">
import type { Task, TaskStatus, TaskPriority } from "~/types";

const props = defineProps<{
  task?: Task | null;
  projectId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const { t } = useI18n();
const { toLocaleString } = useDateLocale();
const { statuses, priorities } = useTaskLabels();
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

const modalTabs = computed(() => [
  { key: "details", label: t("tasks.tabs.details") },
  { key: "comments", label: t("tasks.tabs.comments") },
  { key: "attachments", label: t("tasks.tabs.attachments") },
  { key: "activity", label: t("tasks.tabs.activity") },
]);

const isMobile = ref(false);
let mobileMq: MediaQueryList | null = null;

function updateIsMobile() {
  isMobile.value = mobileMq?.matches ?? false;
}

onMounted(() => {
  mobileMq = window.matchMedia("(max-width: 767px)");
  updateIsMobile();
  mobileMq.addEventListener("change", updateIsMobile);
});

onUnmounted(() => {
  mobileMq?.removeEventListener("change", updateIsMobile);
  mobileMq = null;
});

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

const statusItems = computed(() =>
  statuses.value.map((s) => ({ label: s.label, value: s.value })),
);

const priorityItems = computed(() =>
  priorities.value.map((p) => ({ label: p.label, value: p.value })),
);

const assigneeItems = computed(() => [
  { label: t("tasks.unassigned"), value: null },
  ...memberOptions.value,
]);
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? t('tasks.editTask') : t('tasks.newTask')"
    :fullscreen="isMobile"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        v-if="isEdit"
        class="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2"
      >
        <UButton
          v-for="tab in modalTabs"
          :key="tab.key"
          :variant="activeTab === tab.key ? 'solid' : 'ghost'"
          color="neutral"
          size="xs"
          class="shrink-0"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <div v-if="activeTab === 'details' || !isEdit" class="space-y-4">
        <UFormField :label="t('tasks.title')" required>
          <UInput v-model="form.title" :placeholder="t('tasks.titlePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('tasks.description')">
          <UTextarea
            v-model="form.description"
            :placeholder="t('tasks.descriptionPlaceholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField :label="t('tasks.assignee')">
            <USelect
              v-model="form.assignee_id"
              :items="assigneeItems"
              :placeholder="t('tasks.selectAssignee')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('tasks.status')">
            <USelect
              v-model="form.status"
              :items="statusItems"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('tasks.priority')">
            <USelect
              v-model="form.priority"
              :items="priorityItems"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('tasks.dueDate')">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('tasks.startDate')">
            <UInput v-model="form.start_date" type="date" class="w-full" />
          </UFormField>

          <UFormField :label="t('tasks.labels')">
            <USelect
              v-model="form.label_ids"
              :items="labelOptions"
              multiple
              :placeholder="t('tasks.selectLabels')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div v-if="isEdit && task?.subtasks" class="space-y-2">
          <p class="text-sm font-medium text-slate-700">{{ t("tasks.subtasks") }}</p>
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
            <UInput
              v-model="newSubtask"
              :placeholder="t('tasks.addSubtask')"
              class="flex-1"
              @keyup.enter="handleAddSubtask"
            />
            <UButton size="sm" @click="handleAddSubtask">{{ t("common.add") }}</UButton>
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
          <span class="font-medium">
            {{ log.profiles?.full_name || log.profiles?.email || t("common.system") }}
          </span>
          <span class="text-slate-600">
            {{ log.action }}
            <template v-if="log.field_name">
              {{ log.field_name }}: {{ log.old_value }} → {{ log.new_value }}
            </template>
          </span>
          <p class="text-xs text-slate-400">{{ toLocaleString(log.created_at) }}</p>
        </div>
        <p v-if="activity.length === 0" class="text-sm text-slate-400">{{ t("tasks.noActivity") }}</p>
      </div>
    </template>

    <template v-if="activeTab === 'details' || !isEdit" #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">
          {{ t("common.cancel") }}
        </UButton>
        <UButton :loading="saving" :disabled="!form.title" @click="save">
          {{ isEdit ? t("common.save") : t("common.create") }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
