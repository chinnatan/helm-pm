import { describe, expect, it } from "vitest";
import { buildIssueLogMarkdown, featureTag, type IssueLogItem } from "../../app/utils/issueLog";

const item = (over: Partial<IssueLogItem>): IssueLogItem => ({
  title: "ข้อความ",
  feature: null,
  responseStatus: null,
  responseText: null,
  customerVisible: true,
  requestedOn: "2026-10-06",
  ...over,
});

describe("featureTag", () => {
  it("แปลงช่องว่างเป็นขีดล่าง", () => {
    expect(featureTag("Internal Audit")).toBe("#Internal_Audit");
    expect(featureTag("  Change   Control ")).toBe("#Change_Control");
  });
});

describe("buildIssueLogMarkdown", () => {
  it("ใช้รูปแบบ Q/A คั่นด้วย --- เหมือนโน้ตเดิม", () => {
    const md = buildIssueLogMarkdown(
      [
        item({ title: "Disable ผู้ใช้ได้", feature: "User Management", responseText: "พัฒนาเพิ่มให้ครับ" }),
        item({ title: "แก้ไขรายชื่อผู้ตรวจ", feature: "Internal Audit", responseText: "เก็บไว้พิจารณาครับ" }),
      ],
      { forCustomer: false },
    );
    expect(md).toBe(
      "Q: #User_Management Disable ผู้ใช้ได้\nA: พัฒนาเพิ่มให้ครับ\n\n---\n\nQ: #Internal_Audit แก้ไขรายชื่อผู้ตรวจ\nA: เก็บไว้พิจารณาครับ",
    );
  });

  it("ฉบับลูกค้าซ่อนรายการภายใน ฉบับภายในแสดงทุกรายการ", () => {
    const items = [item({ title: "เห็นได้" }), item({ title: "บั๊กภายใน", customerVisible: false })];
    expect(buildIssueLogMarkdown(items, { forCustomer: true })).not.toContain("บั๊กภายใน");
    expect(buildIssueLogMarkdown(items, { forCustomer: false })).toContain("บั๊กภายใน");
  });

  it("ยังไม่ตอบ: A ว่าง ไม่มี tag เมื่อไม่มีฟีเจอร์", () => {
    expect(buildIssueLogMarkdown([item({ title: "ยังไม่ตอบ" })], { forCustomer: true })).toBe("Q: ยังไม่ตอบ\nA:");
  });

  it("มีสถานะแต่ไม่มีข้อความ ใช้ป้ายสถานะแทน", () => {
    const md = buildIssueLogMarkdown([item({ responseStatus: "deferred" })], {
      forCustomer: true,
      statusLabel: (s) => `[${s}]`,
    });
    expect(md).toContain("A: [deferred]");
  });

  it("ข้อความตอบมีผลเหนือป้ายสถานะ", () => {
    const md = buildIssueLogMarkdown([item({ responseStatus: "accepted", responseText: "ตามนี้" })], {
      forCustomer: true,
      statusLabel: () => "ป้าย",
    });
    expect(md).toContain("A: ตามนี้");
    expect(md).not.toContain("ป้าย");
  });

  it("intro อยู่บนสุดคั่นด้วย --- และ intro ว่างไม่เพิ่มอะไร", () => {
    const items = [item({ title: "ข้อ 1" })];
    expect(buildIssueLogMarkdown(items, { forCustomer: true, intro: "สวัสดีครับ" })).toBe("สวัสดีครับ\n\n---\n\nQ: ข้อ 1\nA:");
    expect(buildIssueLogMarkdown(items, { forCustomer: true, intro: "   " })).toBe("Q: ข้อ 1\nA:");
  });

  it("เรียงตามวันที่รับคำขอ และคงลำดับเดิมเมื่อวันที่เท่ากัน", () => {
    const md = buildIssueLogMarkdown(
      [
        item({ title: "C", requestedOn: "2026-10-07" }),
        item({ title: "A", requestedOn: "2026-10-05" }),
        item({ title: "B", requestedOn: "2026-10-05" }),
      ],
      { forCustomer: false },
    );
    expect([...md.matchAll(/^Q: (.)/gm)].map((m) => m[1])).toEqual(["A", "B", "C"]);
  });

  it("ไม่มีรายการเลย คืนสตริงว่าง (หรือ intro อย่างเดียว)", () => {
    expect(buildIssueLogMarkdown([], { forCustomer: true })).toBe("");
    expect(buildIssueLogMarkdown([], { forCustomer: true, intro: "สวัสดี" })).toBe("สวัสดี");
  });
});
