import type { ResponseStatus } from "~/types";

export type IssueLogItem = {
  title: string;
  /** ชื่อฟีเจอร์ (ใช้เป็น #tag) */
  feature?: string | null;
  responseStatus: ResponseStatus | null;
  responseText: string | null;
  customerVisible: boolean;
  /** YYYY-MM-DD */
  requestedOn: string;
};

export type IssueLogOptions = {
  /** true = ตัดรายการภายใน (customerVisible = false) ออก */
  forCustomer: boolean;
  intro?: string;
  /** คำตอบสำรองเมื่อมีสถานะแต่ไม่มีข้อความตอบ */
  statusLabel?: (status: ResponseStatus) => string;
};

/** "Internal Audit" → "#Internal_Audit" (กติกาเดียวกับ tag ของ Quick capture) */
export const featureTag = (name: string) => `#${name.trim().replace(/\s+/g, "_")}`;

/**
 * สร้าง Issue Log เป็น Markdown รูปแบบเดียวกับโน้ตเดิมใน Obsidian:
 *   Q: #feature ข้อความ
 *   A: คำตอบ          (ว่าง = ยังไม่ตอบ)
 * คั่นแต่ละข้อด้วย `---` เรียงตามวันที่รับคำขอ (คงลำดับเดิมเมื่อวันที่เท่ากัน)
 */
export function buildIssueLogMarkdown(items: IssueLogItem[], opts: IssueLogOptions): string {
  const blocks = items
    .filter((i) => !opts.forCustomer || i.customerVisible)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.requestedOn.localeCompare(b.item.requestedOn) || a.index - b.index)
    .map(({ item }) => {
      const tag = item.feature ? `${featureTag(item.feature)} ` : "";
      const answer =
        item.responseText?.trim() ||
        (item.responseStatus && opts.statusLabel ? opts.statusLabel(item.responseStatus) : "");
      return `Q: ${tag}${item.title}\nA: ${answer}`.trimEnd();
    });

  const intro = opts.intro?.trim();
  return [...(intro ? [intro] : []), ...blocks].join("\n\n---\n\n");
}
