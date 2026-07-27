<script setup lang="ts">
import { format, parseISO, startOfMonth } from "date-fns";
import { th as thLocale, enUS } from "date-fns/locale";
import type { CalendarField } from "~/composables/useWorkspaceMonthCalendar";
import { toMonthKey, monthKeyToStart } from "~/utils/capacityCalendar";

const emit = defineEmits<{ saved: [] }>();

const { t, locale } = useI18n();
const { members, canManageMembers } = useWorkspace();
const {
  fetchMonthCalendars,
  computeMonth,
  upsertCalendarField,
  savingKey: calendarSavingKey,
  headcount,
} = useWorkspaceMonthCalendar();
const {
  fetchMonthCapacities,
  monthHours,
  hasOverride,
  upsertMonthHours,
  savingKey: personSavingKey,
} = useMemberMonthCapacities();

const year = ref(new Date().getFullYear());
const personDraft = reactive<Record<string, string>>({});
const calendarDraft = reactive<Record<string, string>>({});
const saveError = ref("");

const monthKeys = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${year.value}-${m}`;
  }),
);

const teamRows = computed(() => monthKeys.value.map((mk) => computeMonth(mk)));

const yearTotals = computed(() => {
  const burnDays = teamRows.value.reduce((s, r) => s + r.totalBurnDays, 0);
  const burnHours = teamRows.value.reduce((s, r) => s + r.totalBurnHours, 0);
  return {
    burnDays: Math.round(burnDays * 10) / 10,
    burnHours: Math.round(burnHours * 10) / 10,
  };
});

const dateFnsLoc = computed(() => (locale.value === "th" ? thLocale : enUS));

function monthLabel(monthKey: string) {
  return format(parseISO(monthKeyToStart(monthKey)), "MMM", {
    locale: dateFnsLoc.value,
  });
}

function personCellKey(userId: string, monthKey: string) {
  return `${userId}:${monthKey}`;
}

function calendarCellKey(monthKey: string, field: CalendarField) {
  return `${monthKey}:${field}`;
}

function personDisplay(userId: string, monthKey: string) {
  const k = personCellKey(userId, monthKey);
  if (personDraft[k] !== undefined) return personDraft[k];
  return String(monthHours(userId, monthKey));
}

function calendarFieldValue(monthKey: string, field: CalendarField): number | null {
  const row = computeMonth(monthKey);
  if (field === "working_days") {
    // Show effective working days; blank draft means auto
    return row.row?.working_days != null ? row.workingDays : row.autoWorkingDays;
  }
  if (field === "holiday_days") return row.holidayDays;
  if (field === "meeting_days") return row.meetingDays;
  if (field === "company_event_days") return row.companyEventDays;
  if (field === "leave_days") return row.leaveDays;
  return row.hoursPerDay;
}

function calendarDisplay(monthKey: string, field: CalendarField) {
  const k = calendarCellKey(monthKey, field);
  if (calendarDraft[k] !== undefined) return calendarDraft[k];
  const v = calendarFieldValue(monthKey, field);
  return v == null ? "" : String(v);
}

function isWorkingDaysCustom(monthKey: string) {
  return computeMonth(monthKey).row?.working_days != null;
}

async function loadYear() {
  await Promise.all([
    fetchMonthCalendars({
      fromMonth: `${year.value}-01`,
      toMonth: `${year.value}-12`,
    }),
    fetchMonthCapacities({
      fromMonth: `${year.value}-01`,
      toMonth: `${year.value}-12`,
    }),
  ]);
  for (const key of Object.keys(personDraft)) delete personDraft[key];
  for (const key of Object.keys(calendarDraft)) delete calendarDraft[key];
}

onMounted(loadYear);
watch(year, loadYear);

function onPersonFocus(userId: string, monthKey: string) {
  const k = personCellKey(userId, monthKey);
  if (personDraft[k] === undefined) {
    personDraft[k] = String(monthHours(userId, monthKey));
  }
}

function onPersonInput(userId: string, monthKey: string, event: Event) {
  personDraft[personCellKey(userId, monthKey)] = (
    event.target as HTMLInputElement
  ).value;
}

function onCalendarFocus(monthKey: string, field: CalendarField) {
  const k = calendarCellKey(monthKey, field);
  if (calendarDraft[k] === undefined) {
    calendarDraft[k] = calendarDisplay(monthKey, field);
  }
}

function onCalendarInput(
  monthKey: string,
  field: CalendarField,
  event: Event,
) {
  calendarDraft[calendarCellKey(monthKey, field)] = (
    event.target as HTMLInputElement
  ).value;
}

function onEnterBlur(event: Event) {
  (event.target as HTMLInputElement).blur();
}

async function onPersonCommit(userId: string, monthKey: string) {
  if (!canManageMembers.value) return;
  const k = personCellKey(userId, monthKey);
  const raw = personDraft[k];
  saveError.value = "";
  if (raw === undefined) return;

  const trimmed = raw.trim();
  if (trimmed === "") {
    const { error } = await upsertMonthHours(userId, monthKey, null);
    delete personDraft[k];
    if (error) saveError.value = error;
    else emit("saved");
    return;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 400) {
    saveError.value = t("capacity.monthHoursInvalid");
    personDraft[k] = String(monthHours(userId, monthKey));
    return;
  }

  const { error } = await upsertMonthHours(userId, monthKey, n);
  delete personDraft[k];
  if (error) saveError.value = error;
  else emit("saved");
}

async function onCalendarCommit(monthKey: string, field: CalendarField) {
  if (!canManageMembers.value) return;
  const k = calendarCellKey(monthKey, field);
  const raw = calendarDraft[k];
  saveError.value = "";
  if (raw === undefined) return;

  const trimmed = raw.trim();

  // Empty working_days → reset to auto calendar count
  if (field === "working_days" && trimmed === "") {
    const { error } = await upsertCalendarField(monthKey, field, null);
    delete calendarDraft[k];
    if (error) saveError.value = error;
    else emit("saved");
    return;
  }

  if (trimmed === "") {
    delete calendarDraft[k];
    return;
  }

  const n = Number(trimmed);
  const max = field === "hours_per_day" ? 24 : 31;
  if (!Number.isFinite(n) || n < 0 || n > max) {
    saveError.value = t("capacity.calendarInvalid");
    calendarDraft[k] = calendarDisplay(monthKey, field);
    return;
  }

  const { error } = await upsertCalendarField(monthKey, field, n);
  delete calendarDraft[k];
  if (error) saveError.value = error;
  else emit("saved");
}

function shiftYear(delta: number) {
  year.value += delta;
}

const memberRows = computed(() =>
  members.value
    .filter((m) => m.role !== "viewer")
    .map((m) => ({
      userId: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || m.user_id,
    })),
);

const currentMonthKey = computed(() => toMonthKey(startOfMonth(new Date())));

const calendarFields: Array<{
  field: CalendarField;
  labelKey: string;
  highlight?: boolean;
}> = [
  { field: "working_days", labelKey: "capacity.calWorkingDays" },
  { field: "holiday_days", labelKey: "capacity.calHolidays" },
  { field: "meeting_days", labelKey: "capacity.calMeetings" },
  { field: "company_event_days", labelKey: "capacity.calEvents" },
  { field: "leave_days", labelKey: "capacity.calLeave" },
  { field: "hours_per_day", labelKey: "capacity.calHoursPerDay" },
];

const isSaving = computed(
  () => !!(calendarSavingKey.value || personSavingKey.value),
);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-slate-700">
          {{ t("capacity.plannerTitle") }}
        </h2>
        <p class="mt-0.5 max-w-3xl text-xs text-slate-400">
          {{ t("capacity.plannerHint") }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          size="xs"
          color="neutral"
          variant="soft"
          :aria-label="t('capacity.prevYear')"
          @click="shiftYear(-1)"
        />
        <span class="min-w-14 text-center text-sm font-semibold text-slate-800">
          {{ year }}
        </span>
        <UButton
          icon="i-lucide-chevron-right"
          size="xs"
          color="neutral"
          variant="soft"
          :aria-label="t('capacity.nextYear')"
          @click="shiftYear(1)"
        />
      </div>
    </div>

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      :title="saveError"
    />

    <p v-if="!canManageMembers" class="text-xs text-slate-400">
      {{ t("capacity.monthSheetReadOnly") }}
    </p>

    <!-- Team calendar -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-slate-700">
            {{ t("capacity.teamCalendarTitle") }}
          </h3>
          <p class="text-xs text-slate-400">{{ t("capacity.teamCalendarHint") }}</p>
        </div>
        <p class="text-xs text-slate-500">
          {{ t("capacity.headcount") }}:
          <span class="font-semibold text-slate-800">{{ headcount }}</span>
        </p>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-100">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50 text-left text-[11px] text-slate-500">
              <th class="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">
                {{ t("capacity.calMonth") }}
              </th>
              <th
                v-for="col in calendarFields"
                :key="col.field"
                class="whitespace-nowrap px-1 py-2 text-center font-medium"
              >
                {{ t(col.labelKey) }}
              </th>
              <th class="bg-amber-50 px-2 py-2 text-center font-medium text-amber-900">
                {{ t("capacity.calRemaining") }}
              </th>
              <th class="px-2 py-2 text-center font-medium">
                {{ t("capacity.calHeadcount") }}
              </th>
              <th class="bg-rose-50 px-2 py-2 text-center font-medium text-rose-900">
                {{ t("capacity.calTotalBurnDays") }}
              </th>
              <th class="bg-rose-50/70 px-2 py-2 text-center font-medium text-rose-900">
                {{ t("capacity.calTotalBurnHours") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in teamRows"
              :key="row.monthKey"
              class="border-t border-slate-100"
              :class="row.monthKey === currentMonthKey ? 'bg-ocean-50/40' : ''"
            >
              <td
                class="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-slate-800"
                :class="row.monthKey === currentMonthKey ? 'bg-ocean-50/40' : ''"
              >
                {{ year }} {{ monthLabel(row.monthKey) }}
              </td>
              <td
                v-for="col in calendarFields"
                :key="col.field"
                class="px-0.5 py-0.5"
              >
                <input
                  type="number"
                  min="0"
                  :max="col.field === 'hours_per_day' ? 24 : 31"
                  step="0.25"
                  class="w-14 rounded border px-1 py-1 text-center text-xs tabular-nums outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 sm:w-16"
                  :class="
                    col.field === 'working_days' && isWorkingDaysCustom(row.monthKey)
                      ? 'border-ocean-300 bg-ocean-50/50 font-medium'
                      : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200'
                  "
                  :disabled="!canManageMembers"
                  :value="calendarDisplay(row.monthKey, col.field)"
                  :title="
                    col.field === 'working_days'
                      ? t('capacity.calWorkingDaysHint')
                      : undefined
                  "
                  @focus="onCalendarFocus(row.monthKey, col.field)"
                  @input="onCalendarInput(row.monthKey, col.field, $event)"
                  @blur="onCalendarCommit(row.monthKey, col.field)"
                  @keydown.enter="onEnterBlur"
                />
              </td>
              <td class="bg-amber-50 px-2 py-1.5 text-center text-xs font-semibold text-amber-900">
                {{ row.remainingDays }}
              </td>
              <td class="px-2 py-1.5 text-center text-xs text-slate-600">
                {{ row.headcount }}
              </td>
              <td class="bg-rose-50 px-2 py-1.5 text-center text-xs font-semibold text-rose-900">
                {{ row.totalBurnDays }}
              </td>
              <td class="bg-rose-50/70 px-2 py-1.5 text-center text-xs font-medium text-rose-900">
                {{ row.totalBurnHours }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              <td class="sticky left-0 z-10 bg-slate-50 px-3 py-2" colspan="7">
                {{ t("capacity.yearTotal") }}
              </td>
              <td class="bg-amber-50 px-2 py-2 text-center text-amber-900" />
              <td class="px-2 py-2" />
              <td class="bg-rose-50 px-2 py-2 text-center text-rose-900">
                {{ yearTotals.burnDays }}
              </td>
              <td class="bg-rose-50/70 px-2 py-2 text-center text-rose-900">
                {{ yearTotals.burnHours }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Per-person hours -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div class="mb-3">
        <h3 class="text-sm font-semibold text-slate-700">
          {{ t("capacity.personSheetTitle") }}
        </h3>
        <p class="text-xs text-slate-400">{{ t("capacity.personSheetHint") }}</p>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-100">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50 text-left text-xs text-slate-500">
              <th
                class="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium shadow-[1px_0_0_0_#e2e8f0]"
              >
                {{ t("capacity.member") }}
              </th>
              <th
                v-for="mk in monthKeys"
                :key="mk"
                class="px-1 py-2 text-center font-medium"
                :class="mk === currentMonthKey ? 'bg-ocean-50 text-ocean-800' : ''"
              >
                {{ monthLabel(mk) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in memberRows"
              :key="row.userId"
              class="border-t border-slate-100"
            >
              <td
                class="sticky left-0 z-10 max-w-40 truncate bg-white px-3 py-1.5 font-medium text-slate-800 shadow-[1px_0_0_0_#e2e8f0]"
                :title="row.name"
              >
                {{ row.name }}
              </td>
              <td
                v-for="mk in monthKeys"
                :key="mk"
                class="px-0.5 py-0.5"
                :class="mk === currentMonthKey ? 'bg-ocean-50/40' : ''"
              >
                <input
                  type="number"
                  min="0"
                  max="400"
                  step="1"
                  class="w-14 rounded border px-1 py-1 text-center text-xs tabular-nums outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 sm:w-16"
                  :class="
                    hasOverride(row.userId, mk)
                      ? 'border-ocean-300 bg-ocean-50/50 font-medium text-ocean-900'
                      : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200'
                  "
                  :disabled="!canManageMembers"
                  :value="personDisplay(row.userId, mk)"
                  :aria-label="`${row.name} ${mk}`"
                  @focus="onPersonFocus(row.userId, mk)"
                  @input="onPersonInput(row.userId, mk, $event)"
                  @blur="onPersonCommit(row.userId, mk)"
                  @keydown.enter="onEnterBlur"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block h-3 w-6 rounded border border-ocean-300 bg-ocean-50"
          />
          {{ t("capacity.monthCustom") }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block h-3 w-6 rounded border border-transparent bg-slate-50"
          />
          {{ t("capacity.monthDefaultFromCalendar") }}
        </span>
        <span v-if="isSaving" class="text-ocean-700">{{ t("common.loading") }}</span>
      </div>
    </div>
  </div>
</template>
