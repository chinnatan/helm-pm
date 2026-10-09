export type CaptureCustomer = { id: string; name: string; company?: string | null };
export type CaptureFeature = { id: string; name: string };

export type QuickCaptureResult = {
  title: string;
  customerId: string | null;
  featureId: string | null;
  /** tag ที่ผูกสำเร็จ (แสดงเป็น chip) */
  matched: { tag: string; kind: "customer" | "feature"; label: string }[];
};

/** เทียบแบบไม่สนตัวพิมพ์/ช่องว่าง/ขีดล่าง: "change_control" ≡ "Change Control" */
const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, "");

const TAG = /(^|\s)#([^\s#]+)/g;

/**
 * แยก `#tag` ออกจากข้อความแล้วจับคู่กับลูกค้า/ฟีเจอร์
 * - tag ที่ตรงหลายรายการ หรือตรงทั้งลูกค้าและฟีเจอร์ ถือว่ากำกวม → ไม่ผูก คงไว้ในชื่องาน
 * - tag ที่ไม่ตรงอะไรเลยคงไว้ในชื่องาน (ไม่ทิ้งข้อมูลที่ผู้ใช้พิมพ์)
 * - ผูกได้อย่างละ 1 (ลูกค้า 1, ฟีเจอร์ 1) tag ที่ตรงซ้ำชนิดเดิมคงไว้ในชื่องาน
 */
export function parseQuickCapture(
  text: string,
  customers: CaptureCustomer[],
  features: CaptureFeature[],
): QuickCaptureResult {
  const result: QuickCaptureResult = { title: "", customerId: null, featureId: null, matched: [] };

  const title = text.replace(TAG, (whole, lead: string, tag: string) => {
    const key = norm(tag);
    const cs = customers.filter((c) => norm(c.name) === key || (c.company && norm(c.company) === key));
    const fs = features.filter((f) => norm(f.name) === key);

    if (cs.length === 1 && fs.length === 0 && !result.customerId) {
      const c = cs[0]!;
      result.customerId = c.id;
      result.matched.push({ tag, kind: "customer", label: c.company || c.name });
      return lead;
    }
    if (fs.length === 1 && cs.length === 0 && !result.featureId) {
      const f = fs[0]!;
      result.featureId = f.id;
      result.matched.push({ tag, kind: "feature", label: f.name });
      return lead;
    }
    return whole;
  });

  result.title = title.replace(/\s+/g, " ").trim();
  return result;
}
