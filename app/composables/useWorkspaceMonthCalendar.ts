import type { WorkspaceMonthCalendar } from "~/types";
import {
  monthKeyToStart,
  toMonthKey,
  workdaysInMonth,
} from "~/utils/capacityCalendar";

export type CalendarField =
  | "working_days"
  | "holiday_days"
  | "meeting_days"
  | "company_event_days"
  | "leave_days"
  | "hours_per_day";

export interface MonthCalendarComputed {
  monthKey: string;
  monthStart: string;
  row: WorkspaceMonthCalendar | null;
  autoWorkingDays: number;
  workingDays: number;
  holidayDays: number;
  meetingDays: number;
  companyEventDays: number;
  leaveDays: number;
  hoursPerDay: number;
  remainingDays: number;
  headcount: number;
  totalBurnDays: number;
  totalBurnHours: number;
}

export function useWorkspaceMonthCalendar() {
  const supabase = useSupabaseClient();
  const { workspace, members } = useWorkspace();

  const calendars = useState<WorkspaceMonthCalendar[]>(
    "workspaceMonthCalendars",
    () => [],
  );
  const loading = ref(false);
  const savingKey = ref<string | null>(null);

  const byMonth = computed(() => {
    const map: Record<string, WorkspaceMonthCalendar> = {};
    for (const row of calendars.value) {
      map[toMonthKey(row.month_start)] = row;
    }
    return map;
  });

  /** Capacity contributors: non-viewer members */
  const headcount = computed(
    () => members.value.filter((m) => m.role !== "viewer").length,
  );

  async function fetchMonthCalendars(range?: {
    fromMonth: string;
    toMonth: string;
  }) {
    if (!workspace.value) return;
    loading.value = true;
    try {
      let query = supabase
        .from("workspace_month_calendars")
        .select("*")
        .eq("workspace_id", workspace.value.id);

      if (range) {
        query = query
          .gte("month_start", monthKeyToStart(range.fromMonth))
          .lte("month_start", monthKeyToStart(range.toMonth));
      }

      const { data, error } = await query.order("month_start");
      if (error) {
        console.error("fetchMonthCalendars:", error.message);
        return;
      }
      calendars.value = (data ?? []) as WorkspaceMonthCalendar[];
    } finally {
      loading.value = false;
    }
  }

  function computeMonth(monthKey: string): MonthCalendarComputed {
    const row = byMonth.value[monthKey] ?? null;
    const autoWorkingDays = workdaysInMonth(monthKey);
    const workingDays =
      row?.working_days != null ? Number(row.working_days) : autoWorkingDays;
    const holidayDays = Number(row?.holiday_days ?? 0);
    const meetingDays = Number(row?.meeting_days ?? 0);
    const companyEventDays = Number(row?.company_event_days ?? 0);
    const leaveDays = Number(row?.leave_days ?? 0);
    const hoursPerDay = Number(row?.hours_per_day ?? 8);
    const remainingDays = Math.max(
      0,
      Math.round(
        (workingDays - holidayDays - meetingDays - companyEventDays - leaveDays) *
          100,
      ) / 100,
    );
    const hc = headcount.value;
    const totalBurnDays = Math.round(remainingDays * hc * 10) / 10;
    const totalBurnHours =
      Math.round(remainingDays * hoursPerDay * hc * 10) / 10;

    return {
      monthKey,
      monthStart: monthKeyToStart(monthKey),
      row,
      autoWorkingDays,
      workingDays,
      holidayDays,
      meetingDays,
      companyEventDays,
      leaveDays,
      hoursPerDay,
      remainingDays,
      headcount: hc,
      totalBurnDays,
      totalBurnHours,
    };
  }

  /** Default personal hours for a month from team calendar */
  function defaultPersonHoursFromCalendar(monthKey: string): number {
    const c = computeMonth(monthKey);
    return Math.round(c.remainingDays * c.hoursPerDay * 10) / 10;
  }

  async function upsertCalendarField(
    monthKey: string,
    field: CalendarField,
    value: number | null,
  ) {
    if (!workspace.value) return { error: "No workspace" };

    savingKey.value = `${monthKey}:${field}`;
    const monthStart = monthKeyToStart(monthKey);
    const existing = byMonth.value[monthKey];

    try {
      const payload: {
        workspace_id: string;
        month_start: string;
        working_days: number | null;
        holiday_days: number;
        meeting_days: number;
        company_event_days: number;
        leave_days: number;
        hours_per_day: number;
        notes: string | null;
        updated_at: string;
      } = {
        workspace_id: workspace.value.id,
        month_start: monthStart,
        working_days: existing?.working_days ?? null,
        holiday_days: Number(existing?.holiday_days ?? 0),
        meeting_days: Number(existing?.meeting_days ?? 0),
        company_event_days: Number(existing?.company_event_days ?? 0),
        leave_days: Number(existing?.leave_days ?? 0),
        hours_per_day: Number(existing?.hours_per_day ?? 8),
        notes: existing?.notes ?? null,
        updated_at: new Date().toISOString(),
      };

      if (field === "working_days") {
        payload.working_days = value;
      } else if (field === "hours_per_day") {
        payload.hours_per_day = value == null || value <= 0 ? 8 : value;
      } else if (field === "holiday_days") {
        payload.holiday_days = value == null || value < 0 ? 0 : value;
      } else if (field === "meeting_days") {
        payload.meeting_days = value == null || value < 0 ? 0 : value;
      } else if (field === "company_event_days") {
        payload.company_event_days = value == null || value < 0 ? 0 : value;
      } else if (field === "leave_days") {
        payload.leave_days = value == null || value < 0 ? 0 : value;
      }

      const { data, error } = await supabase
        .from("workspace_month_calendars")
        .upsert(payload, { onConflict: "workspace_id,month_start" })
        .select()
        .single();

      if (!error && data) {
        const row = data as WorkspaceMonthCalendar;
        const idx = calendars.value.findIndex(
          (r) => toMonthKey(r.month_start) === monthKey,
        );
        if (idx >= 0) calendars.value[idx] = row;
        else calendars.value.push(row);
      }
      return { error: error?.message };
    } finally {
      savingKey.value = null;
    }
  }

  return {
    calendars,
    loading,
    savingKey,
    byMonth,
    headcount,
    fetchMonthCalendars,
    computeMonth,
    defaultPersonHoursFromCalendar,
    upsertCalendarField,
  };
}
