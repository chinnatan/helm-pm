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

export type ShareRollout = {
  feature: string;
  status: RolloutStatus;
  commitments: { month: string; target_status: string }[];
};

/**
 * จัดกลุ่ม Rollout ตามเดือนที่สัญญาไว้ (เรียงเดือนเก่า→ใหม่) — Rollout ที่ยังไม่มี Commitment อยู่กลุ่ม month = null ท้ายสุด
 * Rollout ที่มีหลาย Commitment ปรากฏในทุกเดือนนั้น
 */
export function groupShareTimeline(rollouts: ShareRollout[]) {
  const byMonth = new Map<string | null, { feature: string; status: RolloutStatus }[]>();
  for (const r of rollouts) {
    const months = r.commitments.length ? r.commitments.map((c) => c.month) : [null];
    for (const m of months) {
      const list = byMonth.get(m) ?? [];
      list.push({ feature: r.feature, status: r.status });
      byMonth.set(m, list);
    }
  }
  return [...byMonth.entries()]
    .map(([month, items]) => ({ month, items }))
    .sort((a, b) => (a.month === null ? 1 : b.month === null ? -1 : a.month.localeCompare(b.month)));
}
