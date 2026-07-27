import type { MemberMonthCapacity } from "~/types";
import { DEFAULT_WEEKLY_CAPACITY_HOURS } from "~/types";
import {
  defaultMonthHoursFromWeekly,
  monthKeyToStart,
  toMonthKey,
  weekCapacityFromMonths,
  workdaysInMonth,
} from "~/utils/capacityCalendar";

export {
  defaultMonthHoursFromWeekly,
  monthKeyToStart,
  toMonthKey,
  weekCapacityFromMonths,
  workdaysInMonth,
} from "~/utils/capacityCalendar";

export function useMemberMonthCapacities() {
  const supabase = useSupabaseClient();
  const { workspace, members } = useWorkspace();
  const { byMonth, defaultPersonHoursFromCalendar } = useWorkspaceMonthCalendar();

  const monthCapacities = useState<MemberMonthCapacity[]>(
    "memberMonthCapacities",
    () => [],
  );
  const loading = ref(false);
  const savingKey = ref<string | null>(null);

  /** Map userId -> monthKey -> hours (override only) */
  const overrideMap = computed(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const row of monthCapacities.value) {
      const mk = toMonthKey(row.month_start);
      if (!map[row.user_id]) map[row.user_id] = {};
      map[row.user_id]![mk] = Number(row.hours);
    }
    return map;
  });

  function baselineWeekly(userId: string): number {
    const m = members.value.find((x) => x.user_id === userId);
    const h = m?.weekly_capacity_hours;
    return h != null && Number(h) > 0
      ? Number(h)
      : DEFAULT_WEEKLY_CAPACITY_HOURS;
  }

  /** Effective month hours: override → team calendar → weekly baseline */
  function monthHours(userId: string, monthKey: string): number {
    const override = overrideMap.value[userId]?.[monthKey];
    if (override != null) return override;
    if (byMonth.value[monthKey]) {
      return defaultPersonHoursFromCalendar(monthKey);
    }
    return defaultMonthHoursFromWeekly(baselineWeekly(userId), monthKey);
  }

  function hasOverride(userId: string, monthKey: string): boolean {
    return overrideMap.value[userId]?.[monthKey] != null;
  }

  async function fetchMonthCapacities(range?: {
    fromMonth: string;
    toMonth: string;
  }) {
    if (!workspace.value) return;
    loading.value = true;
    try {
      let query = supabase
        .from("member_month_capacities")
        .select("*")
        .eq("workspace_id", workspace.value.id);

      if (range) {
        query = query
          .gte("month_start", monthKeyToStart(range.fromMonth))
          .lte("month_start", monthKeyToStart(range.toMonth));
      }

      const { data, error } = await query.order("month_start");
      if (error) {
        console.error("fetchMonthCapacities:", error.message);
        return;
      }
      monthCapacities.value = (data ?? []) as MemberMonthCapacity[];
    } finally {
      loading.value = false;
    }
  }

  async function upsertMonthHours(
    userId: string,
    monthKey: string,
    hours: number | null,
  ) {
    if (!workspace.value) return { error: "No workspace" };

    const key = `${userId}:${monthKey}`;
    savingKey.value = key;
    const monthStart = monthKeyToStart(monthKey);

    try {
      if (hours == null || Number.isNaN(hours)) {
        const { error } = await supabase
          .from("member_month_capacities")
          .delete()
          .eq("workspace_id", workspace.value.id)
          .eq("user_id", userId)
          .eq("month_start", monthStart);
        if (!error) {
          monthCapacities.value = monthCapacities.value.filter(
            (r) =>
              !(
                r.user_id === userId &&
                toMonthKey(r.month_start) === monthKey
              ),
          );
        }
        return { error: error?.message };
      }

      const clamped = Math.min(400, Math.max(0, hours));
      const { data, error } = await supabase
        .from("member_month_capacities")
        .upsert(
          {
            workspace_id: workspace.value.id,
            user_id: userId,
            month_start: monthStart,
            hours: clamped,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,user_id,month_start" },
        )
        .select()
        .single();

      if (!error && data) {
        const row = data as MemberMonthCapacity;
        const idx = monthCapacities.value.findIndex(
          (r) =>
            r.user_id === userId && toMonthKey(r.month_start) === monthKey,
        );
        if (idx >= 0) monthCapacities.value[idx] = row;
        else monthCapacities.value.push(row);
      }
      return { error: error?.message };
    } finally {
      savingKey.value = null;
    }
  }

  return {
    monthCapacities,
    loading,
    savingKey,
    overrideMap,
    baselineWeekly,
    monthHours,
    hasOverride,
    fetchMonthCapacities,
    upsertMonthHours,
    defaultMonthHoursFromWeekly,
    weekCapacityFromMonths,
    toMonthKey,
    monthKeyToStart,
    workdaysInMonth,
  };
}
