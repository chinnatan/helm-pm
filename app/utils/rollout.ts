import type { RolloutStatus } from "~/types";

/** class ครบทั้งสตริงเพื่อให้ Tailwind JIT เห็น */
export const ROLLOUT_STATUS_STYLE: Record<RolloutStatus, string> = {
  planned: "border-slate-300 bg-slate-50 text-slate-700",
  developing: "border-blue-300 bg-blue-50 text-blue-800",
  testing: "border-amber-300 bg-amber-50 text-amber-800",
  production: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-400 line-through",
};

/** YYYY-MM-01 → บวก/ลบเดือน (คืนวันแรกของเดือน) */
export function addMonths(monthStart: string, delta: number) {
  const [y, m] = monthStart.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** ค่าจาก <input type="month"> (YYYY-MM) → YYYY-MM-01 */
export function monthInputToStart(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : "";
}

/** month ต้องเป็นวันแรกของเดือน (YYYY-MM-01) */
export function toMonthStart(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
