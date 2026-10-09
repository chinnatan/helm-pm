import { describe, expect, it } from "vitest";
import { addMonths, groupShareTimeline, monthInputToStart, toMonthStart } from "../../app/utils/rollout";

describe("addMonths", () => {
  it("บวก/ลบเดือนและข้ามปี", () => {
    expect(addMonths("2026-10-01", 1)).toBe("2026-11-01");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", 6)).toBe("2027-04-01");
  });
});

describe("monthInputToStart", () => {
  it("แปลงค่า input type=month เป็นวันแรกของเดือน", () => {
    expect(monthInputToStart("2026-10")).toBe("2026-10-01");
  });
  it("ค่าที่ไม่ใช่ YYYY-MM คืนสตริงว่าง", () => {
    expect(monthInputToStart("")).toBe("");
    expect(monthInputToStart("2026-10-05")).toBe("");
  });
});

describe("toMonthStart", () => {
  it("คืนวันแรกของเดือนจากวันที่ใดก็ได้ในเดือน", () => {
    expect(toMonthStart(new Date(2026, 9, 17))).toBe("2026-10-01");
    expect(toMonthStart("2026-03-31T12:00:00")).toBe("2026-03-01");
  });
});

describe("groupShareTimeline", () => {
  it("จัดกลุ่มตามเดือน เรียงเก่า→ใหม่ และ Rollout ไม่มีเดือนอยู่ท้ายสุด", () => {
    const groups = groupShareTimeline([
      { feature: "CAPA", status: "planned", commitments: [{ month: "2026-11-01", target_status: "production" }] },
      { feature: "NCR", status: "production", commitments: [{ month: "2026-10-01", target_status: "production" }] },
      { feature: "Dashboard", status: "planned", commitments: [] },
      { feature: "Change Control", status: "production", commitments: [{ month: "2026-10-01", target_status: "production" }] },
    ]);
    expect(groups.map((g) => g.month)).toEqual(["2026-10-01", "2026-11-01", null]);
    expect(groups[0]!.items.map((i) => i.feature)).toEqual(["NCR", "Change Control"]);
  });

  it("Rollout ที่มีหลาย Commitment ปรากฏในทุกเดือนนั้น", () => {
    const groups = groupShareTimeline([
      {
        feature: "CAPA",
        status: "developing",
        commitments: [
          { month: "2026-11-01", target_status: "testing" },
          { month: "2027-01-01", target_status: "production" },
        ],
      },
    ]);
    expect(groups.map((g) => g.month)).toEqual(["2026-11-01", "2027-01-01"]);
  });

  it("ไม่มี Rollout คืนอาร์เรย์ว่าง", () => {
    expect(groupShareTimeline([])).toEqual([]);
  });
});
