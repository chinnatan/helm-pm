import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { DEFAULT_WEEKLY_CAPACITY_HOURS } from "~/types";

/** yyyy-MM */
export function toMonthKey(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(startOfMonth(d), "yyyy-MM");
}

export function monthKeyToStart(monthKey: string): string {
  return `${monthKey}-01`;
}

export function workdaysInMonth(monthKey: string): number {
  const start = startOfMonth(parseISO(monthKeyToStart(monthKey)));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

/** Default month hours from weekly baseline: weekly × (workdays / 5) */
export function defaultMonthHoursFromWeekly(
  weeklyHours: number,
  monthKey: string,
): number {
  const weekly =
    weeklyHours > 0 ? weeklyHours : DEFAULT_WEEKLY_CAPACITY_HOURS;
  const workdays = workdaysInMonth(monthKey);
  return Math.round(((weekly * workdays) / 5) * 10) / 10;
}

/**
 * Capacity for a Mon–Sun week: sum of daily shares from each calendar month.
 * Day share = monthHours / workdaysInMonth.
 */
export function weekCapacityFromMonths(
  weekStart: Date,
  getMonthHours: (monthKey: string) => number,
): number {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const day = addDays(weekStart, i);
    if (isWeekend(day)) continue;
    const mk = toMonthKey(day);
    const monthHours = getMonthHours(mk);
    const wd = workdaysInMonth(mk) || getDaysInMonth(day);
    total += monthHours / wd;
  }
  return Math.round(total * 10) / 10;
}
