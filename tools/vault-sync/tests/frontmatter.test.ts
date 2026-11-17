import { describe, expect, it } from "vitest";
import { parseDependsOn, parseFrontmatter, setFrontmatterValues } from "../src/frontmatter";
import { toHelmStatus, toVaultStatus } from "../src/status";

const doc = `---
type: task
id: T-CC-01
module: <โมดูล>   # คอมเมนต์ไทย
status: todo            # todo | in-progress | review
depends_on: ["[[T-CC-00 Spike ตรวจต้นทาง]]", "[[T-CC-02 x|T-CC-02]]"]
pm-task: true
---
# T-CC-01 · หัวเรื่อง
status: ในเนื้อหาห้ามแตะ
`;

describe("frontmatter", () => {
  it("parses scalars, comments, depends_on", () => {
    const fm = parseFrontmatter(doc)!;
    expect(fm.fields.id).toBe("T-CC-01");
    expect(fm.fields.status).toBe("todo");
    expect(fm.fields.module).toBe("<โมดูล>");
    expect(parseDependsOn(fm)).toEqual(["T-CC-00", "T-CC-02"]);
  });
  it("parses block-list and empty depends_on", () => {
    expect(parseDependsOn(parseFrontmatter("---\ndepends_on:\n  - \"[[T-A-1 x]]\"\n  - T-A-2\n---\n")!)).toEqual(["T-A-1"]);
    expect(parseDependsOn(parseFrontmatter("---\ndepends_on: []\n---\n")!)).toEqual([]);
  });
  it("edits only the target line, keeps comment and everything else byte-for-byte", () => {
    const out = setFrontmatterValues(doc, { status: "in-progress" });
    expect(out).toBe(doc.replace("status: todo            #", "status: in-progress            #"));
  });
  it("keeps quote style and replaces empty values", () => {
    const t = '---\nid: "T-1"\nstatus: "cancelled"\ndue: ""\n---\nbody\n';
    expect(setFrontmatterValues(t, { status: "superseded", due: "2026-11-02" })).toBe(
      '---\nid: "T-1"\nstatus: "superseded"\ndue: "2026-11-02"\n---\nbody\n',
    );
  });
  it("inserts absent keys inside frontmatter without touching other lines", () => {
    const out = setFrontmatterValues(doc, { assignee: '"สมชาย ใจดี"', due: "2026-11-30" });
    expect(out).toBe(doc.replace("pm-task: true\n---", 'pm-task: true\nassignee: "สมชาย ใจดี"\ndue: 2026-11-30\n---'));
  });
  it("preserves CRLF", () => {
    const crlf = "---\r\nid: T-1\r\nstatus: todo\r\n---\r\nเนื้อหา\r\n";
    expect(setFrontmatterValues(crlf, { status: "done", due: "2026-01-01" })).toBe(
      "---\r\nid: T-1\r\nstatus: done\r\ndue: 2026-01-01\r\n---\r\nเนื้อหา\r\n",
    );
  });
  it("leaves files without frontmatter alone", () => {
    expect(setFrontmatterValues("# hi\nstatus: x\n", { status: "done" })).toBe("# hi\nstatus: x\n");
  });
});

describe("status mapping", () => {
  it.each([["todo", "todo"], ["in_progress", "in-progress"], ["testing", "review"], ["done", "done"], ["cancelled", "superseded"]])(
    "%s <-> %s",
    (h, v) => {
      expect(toVaultStatus(h)).toBe(v);
      expect(toHelmStatus(v)).toBe(h);
    },
  );
  it("inbox is never written; blocked is not valid", () => {
    expect(toVaultStatus("inbox")).toBeNull();
    expect(toHelmStatus("blocked")).toBeNull();
  });
});
