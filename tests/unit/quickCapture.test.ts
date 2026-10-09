import { describe, expect, it } from "vitest";
import { parseQuickCapture } from "../../app/utils/quickCapture";

const customers = [
  { id: "c-sjc", name: "SJC", company: "SJC Co." },
  { id: "c-tnt", name: "TNT" },
];
const features = [
  { id: "f-cc", name: "Change Control" },
  { id: "f-capa", name: "CAPA" },
];

describe("parseQuickCapture", () => {
  it("ผูกลูกค้าจาก tag และตัด tag ออกจากชื่องาน", () => {
    const r = parseQuickCapture("แก้ปุ่ม export #SJC", customers, features);
    expect(r).toMatchObject({ title: "แก้ปุ่ม export", customerId: "c-sjc", featureId: null });
  });

  it("ผูกฟีเจอร์ โดยขีดล่างเท่ากับช่องว่างและไม่สนตัวพิมพ์", () => {
    const r = parseQuickCapture("#change_control การ์ดไม่แสดงบน mobile", customers, features);
    expect(r).toMatchObject({ title: "การ์ดไม่แสดงบน mobile", featureId: "f-cc" });
  });

  it("ผูกได้ทั้งลูกค้าและฟีเจอร์ในข้อความเดียว", () => {
    const r = parseQuickCapture("ทำ capa #tnt #CAPA ให้เสร็จ", customers, features);
    expect(r).toMatchObject({ title: "ทำ capa ให้เสร็จ", customerId: "c-tnt", featureId: "f-capa" });
    expect(r.matched.map((m) => m.kind)).toEqual(["customer", "feature"]);
  });

  it("จับคู่จากชื่อบริษัทของลูกค้าได้ด้วย", () => {
    expect(parseQuickCapture("งาน #sjc.co.", customers, features).customerId).toBeNull();
    expect(parseQuickCapture("งาน #SJCCo.", customers, features).customerId).toBe("c-sjc");
  });

  it("tag ที่ไม่ตรงอะไรเลยคงไว้ในชื่องาน", () => {
    const r = parseQuickCapture("ตั้ง nginx #infra", customers, features);
    expect(r).toMatchObject({ title: "ตั้ง nginx #infra", customerId: null, featureId: null });
  });

  it("tag กำกวม (ตรงทั้งลูกค้าและฟีเจอร์) ไม่ผูก", () => {
    const r = parseQuickCapture(
      "งาน #capa",
      [...customers, { id: "c-capa", name: "Capa" }],
      features,
    );
    expect(r).toMatchObject({ title: "งาน #capa", customerId: null, featureId: null });
  });

  it("tag ตรงหลายลูกค้า (ชื่อซ้ำ) ไม่ผูก", () => {
    const r = parseQuickCapture("งาน #tnt", [...customers, { id: "c-tnt2", name: "tnt" }], features);
    expect(r.customerId).toBeNull();
    expect(r.title).toBe("งาน #tnt");
  });

  it("ผูกลูกค้าได้คนเดียว tag ลูกค้าตัวที่สองคงไว้ในชื่องาน", () => {
    const r = parseQuickCapture("เทียบ #SJC กับ #TNT", customers, features);
    expect(r).toMatchObject({ customerId: "c-sjc", title: "เทียบ กับ #TNT" });
  });

  it("ไม่มี tag คืนข้อความเดิม (ตัดช่องว่างซ้ำ)", () => {
    expect(parseQuickCapture("  จดเฉย ๆ   ไม่มี tag ", customers, features).title).toBe("จดเฉย ๆ ไม่มี tag");
  });

  it("ชื่อว่างหลังตัด tag คืนสตริงว่าง ให้ UI ปิดปุ่มบันทึก", () => {
    expect(parseQuickCapture("#SJC #CAPA", customers, features).title).toBe("");
  });

  it("ไม่ถือ # กลางคำเป็น tag", () => {
    const r = parseQuickCapture("issue#12 เรื่อง SJC", customers, features);
    expect(r.title).toBe("issue#12 เรื่อง SJC");
  });
});
