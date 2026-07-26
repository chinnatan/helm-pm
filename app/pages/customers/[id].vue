<script setup lang="ts">
import type { Customer, Requirement, Task } from "~/types";
import { REQUIREMENT_STATUS_VALUES } from "~/types";
import { format, parseISO } from "date-fns";

definePageMeta({ middleware: "auth" });

const { t } = useI18n();
const route = useRoute();
const customerId = computed(() => route.params.id as string);
const customerIdRef = toRef(() => route.params.id as string);

const { fetchWorkspace } = useWorkspace();
const { projects, fetchProjects } = useProjects();
const {
  getCustomer,
  updateCustomer,
  archiveCustomer,
  fetchOpenTasksForCustomer,
  fetchCustomers,
} = useCustomers();
const { meetings, createMeeting, fetchMeetings } = useMeetings(customerIdRef);
const {
  requirements,
  createRequirement,
  updateRequirement,
  createTaskFromRequirement,
  fetchRequirements,
} = useRequirements(customerIdRef);

const customer = ref<Customer | null>(null);
const openTasks = ref<Task[]>([]);
const loading = ref(true);
const saving = ref(false);

const editForm = reactive({
  name: "",
  company: "",
  contact_email: "",
  notes: "",
});

const showMeeting = ref(false);
const meetingForm = reactive({
  title: "",
  met_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  summary: "",
});
const savingMeeting = ref(false);

const showRequirement = ref(false);
const requirementForm = reactive({
  title: "",
  description: "",
  meeting_id: null as string | null,
});
const savingRequirement = ref(false);

const showCreateTask = ref(false);
const selectedRequirement = ref<Requirement | null>(null);
const selectedProjectId = ref<string | undefined>(undefined);
const creatingTask = ref(false);

const customerProjects = computed(() =>
  projects.value.filter((p) => p.customer_id === customerId.value),
);

const projectItems = computed(() => {
  const list =
    customerProjects.value.length > 0 ? customerProjects.value : projects.value;
  return list.map((p) => ({ label: p.name, value: p.id }));
});

const meetingItems = computed(() => [
  { label: t("common.none"), value: null },
  ...meetings.value.map((m) => ({
    label: `${m.title} (${format(parseISO(m.met_at), "d MMM yyyy")})`,
    value: m.id,
  })),
]);

const requirementStatusItems = computed(() =>
  REQUIREMENT_STATUS_VALUES.map((s) => ({
    label: t(`customers.requirementStatus.${s}`),
    value: s,
  })),
);

async function load() {
  loading.value = true;
  await Promise.all([fetchWorkspace(), fetchProjects(), fetchCustomers()]);
  customer.value = await getCustomer(customerId.value);
  if (customer.value) {
    editForm.name = customer.value.name;
    editForm.company = customer.value.company ?? "";
    editForm.contact_email = customer.value.contact_email ?? "";
    editForm.notes = customer.value.notes ?? "";
  }
  openTasks.value = await fetchOpenTasksForCustomer(customerId.value);
  await Promise.all([fetchMeetings(), fetchRequirements()]);
  loading.value = false;
}

onMounted(load);

async function handleSaveCustomer() {
  if (!customer.value || !editForm.name.trim()) return;
  saving.value = true;
  const { data } = await updateCustomer(customer.value.id, {
    name: editForm.name.trim(),
    company: editForm.company.trim() || null,
    contact_email: editForm.contact_email.trim() || null,
    notes: editForm.notes.trim() || null,
  });
  if (data) customer.value = data;
  saving.value = false;
}

async function handleArchive() {
  if (!customer.value) return;
  await archiveCustomer(customer.value.id);
  navigateTo("/customers");
}

async function handleCreateMeeting() {
  if (!meetingForm.title.trim()) return;
  savingMeeting.value = true;
  await createMeeting({
    title: meetingForm.title.trim(),
    met_at: new Date(meetingForm.met_at).toISOString(),
    summary: meetingForm.summary.trim() || null,
  });
  savingMeeting.value = false;
  showMeeting.value = false;
  meetingForm.title = "";
  meetingForm.summary = "";
  meetingForm.met_at = format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

async function handleCreateRequirement() {
  if (!requirementForm.title.trim()) return;
  savingRequirement.value = true;
  await createRequirement({
    title: requirementForm.title.trim(),
    description: requirementForm.description.trim() || null,
    meeting_id: requirementForm.meeting_id,
  });
  savingRequirement.value = false;
  showRequirement.value = false;
  requirementForm.title = "";
  requirementForm.description = "";
  requirementForm.meeting_id = null;
}

function openCreateTaskModal(req: Requirement) {
  selectedRequirement.value = req;
  selectedProjectId.value =
    customerProjects.value[0]?.id ?? projects.value[0]?.id ?? undefined;
  showCreateTask.value = true;
}

async function handleCreateTaskFromRequirement() {
  if (!selectedRequirement.value || !selectedProjectId.value) return;
  creatingTask.value = true;
  await createTaskFromRequirement(
    selectedRequirement.value.id,
    selectedProjectId.value,
  );
  openTasks.value = await fetchOpenTasksForCustomer(customerId.value);
  creatingTask.value = false;
  showCreateTask.value = false;
  selectedRequirement.value = null;
}

async function handleRequirementStatus(req: Requirement, status: string) {
  await updateRequirement(req.id, {
    status: status as Requirement["status"],
  });
}

function formatMeetingDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="p-4 md:p-6">
    <div class="mb-4">
      <NuxtLink
        to="/customers"
        class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ocean-800"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        {{ t("customers.back") }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-slate-400" />
    </div>

    <div v-else-if="!customer" class="py-12 text-center text-slate-500">
      {{ t("customers.notFound") }}
    </div>

    <template v-else>
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">{{ customer.name }}</h1>
          <p v-if="customer.company" class="text-sm text-slate-500">{{ customer.company }}</p>
        </div>
        <UButton variant="ghost" color="error" size="sm" @click="handleArchive">
          {{ t("customers.archive") }}
        </UButton>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Details -->
        <section class="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ t("customers.details") }}
          </h2>
          <div class="space-y-3">
            <UFormField :label="t('customers.name')">
              <UInput v-model="editForm.name" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.company')">
              <UInput v-model="editForm.company" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.contactEmail')">
              <UInput v-model="editForm.contact_email" type="email" class="w-full" />
            </UFormField>
            <UFormField :label="t('customers.notes')">
              <RichTextEditor v-model="editForm.notes" :rows="3" variant="full" />
            </UFormField>
            <UButton :loading="saving" @click="handleSaveCustomer">
              {{ t("common.save") }}
            </UButton>
          </div>
        </section>

        <div class="space-y-6 lg:col-span-2">
          <!-- Open tasks -->
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {{ t("customers.openTasks") }}
              <span class="ml-1 text-ocean-800">({{ openTasks.length }})</span>
            </h2>
            <ul v-if="openTasks.length" class="divide-y divide-slate-100">
              <li
                v-for="task in openTasks"
                :key="task.id"
                class="flex items-center justify-between gap-3 py-2.5"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-800">{{ task.title }}</p>
                  <p class="text-xs text-slate-500">
                    {{ task.projects?.name }} · {{ t(`status.${task.status}`) }}
                  </p>
                </div>
                <NuxtLink
                  :to="`/projects/${task.project_id}/board`"
                  class="shrink-0 text-xs font-medium text-ocean-800 hover:underline"
                >
                  {{ t("customers.viewProject") }}
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("customers.noOpenTasks") }}</p>
          </section>

          <!-- Meetings -->
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {{ t("customers.meetings") }}
              </h2>
              <UButton size="xs" icon="i-lucide-plus" @click="showMeeting = true">
                {{ t("customers.addMeeting") }}
              </UButton>
            </div>
            <ul v-if="meetings.length" class="space-y-3">
              <li
                v-for="meeting in meetings"
                :key="meeting.id"
                class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="font-medium text-slate-800">{{ meeting.title }}</p>
                  <span class="shrink-0 text-xs text-slate-500">
                    {{ formatMeetingDate(meeting.met_at) }}
                  </span>
                </div>
                <RichTextContent
                  v-if="meeting.summary"
                  class="mt-1 text-slate-600"
                  :content="meeting.summary"
                />
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("customers.noMeetings") }}</p>
          </section>

          <!-- Requirements -->
          <section class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {{ t("customers.requirements") }}
              </h2>
              <UButton size="xs" icon="i-lucide-plus" @click="showRequirement = true">
                {{ t("customers.addRequirement") }}
              </UButton>
            </div>
            <ul v-if="requirements.length" class="space-y-3">
              <li
                v-for="req in requirements"
                :key="req.id"
                class="rounded-lg border border-slate-100 px-3 py-2.5"
              >
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <p class="font-medium text-slate-800">{{ req.title }}</p>
                    <RichTextContent
                      v-if="req.description"
                      class="mt-0.5 text-slate-600"
                      :content="req.description"
                    />
                    <p v-if="req.meetings" class="mt-1 text-xs text-slate-400">
                      {{ t("customers.fromMeeting") }}: {{ req.meetings.title }}
                    </p>
                  </div>
                  <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <USelect
                      :model-value="req.status"
                      :items="requirementStatusItems"
                      size="sm"
                      class="w-36"
                      @update:model-value="(v) => handleRequirementStatus(req, String(v))"
                    />
                    <UButton
                      v-if="!req.task_id"
                      size="xs"
                      variant="outline"
                      @click="openCreateTaskModal(req)"
                    >
                      {{ t("customers.createAsTask") }}
                    </UButton>
                    <UBadge v-else color="success" variant="subtle" size="sm">
                      {{ t("customers.linkedTask") }}
                    </UBadge>
                  </div>
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">{{ t("customers.noRequirements") }}</p>
          </section>
        </div>
      </div>
    </template>

    <UModal v-model:open="showMeeting" :title="t('customers.addMeeting')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('customers.meetingTitle')" required>
            <UInput v-model="meetingForm.title" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.metAt')">
            <UInput v-model="meetingForm.met_at" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.summary')">
            <RichTextEditor v-model="meetingForm.summary" :rows="3" variant="full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showMeeting = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="savingMeeting"
            :disabled="!meetingForm.title.trim()"
            @click="handleCreateMeeting"
          >
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showRequirement" :title="t('customers.addRequirement')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('customers.requirementTitle')" required>
            <UInput v-model="requirementForm.title" class="w-full" />
          </UFormField>
          <UFormField :label="t('customers.requirementDescription')">
            <RichTextEditor v-model="requirementForm.description" :rows="3" variant="full" />
          </UFormField>
          <UFormField :label="t('customers.linkMeeting')">
            <USelect
              v-model="requirementForm.meeting_id"
              :items="meetingItems"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showRequirement = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="savingRequirement"
            :disabled="!requirementForm.title.trim()"
            @click="handleCreateRequirement"
          >
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showCreateTask" :title="t('customers.createAsTask')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            {{ selectedRequirement?.title }}
          </p>
          <UFormField :label="t('customers.selectProject')" required>
            <USelect
              v-model="selectedProjectId"
              :items="projectItems"
              :placeholder="t('customers.selectProject')"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showCreateTask = false">
            {{ t("common.cancel") }}
          </UButton>
          <UButton
            :loading="creatingTask"
            :disabled="!selectedProjectId"
            @click="handleCreateTaskFromRequirement"
          >
            {{ t("common.create") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
