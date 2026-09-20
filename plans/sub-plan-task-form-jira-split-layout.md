# Task/Subtask Form Split Layout (Jira-style) — ปรับ UIUX การ์ดเพิ่มงาน/แก้ไข/งานย่อย เป็น ซ้าย-ขวา

## Business Goals

- ผู้ใช้โฟกัสกับการพิมพ์ "ชื่องาน + คำอธิบาย" ได้ทันทีโดยไม่ต้อง scroll (อ้างอิงรูปแบบ Jira)
- ลดการ scroll down เพื่อ set ค่าอื่นๆ (assignee, status, dates, ฯลฯ) โดยย้ายไปไว้คอลัมน์ขวา
- ใช้ได้ทั้ง TaskModal (เพิ่ม/แก้ไข/สร้างเป็นงานย่อย) และ SubtaskModal (แก้ไขงานย่อย) ให้หน้าตาเป็น pattern เดียวกัน

---

## Phase 1: TaskModal — Split Layout

### Modal Canvas

- [x] กว้าง modal บน desktop ให้พอสำหรับ 2 คอลัมน์ (ปรับ `:ui` ของ `UModal` เป็น `sm:max-w-5xl`, ไม่กระทบ fullscreen บน mobile)

### Left Section (ชื่องาน + คำอธิบาย)

- [x] จัด left column: template select + parent task (create เท่านั้น) → title → description (RichTextEditor) ตามลำดับเดิม
- [x] เพิ่มความสูง description editor (`:rows` 3 → 6) เพื่อใช้พื้นที่แนวตั้งฝั่งซ้ายให้คุ้มแบบ Jira

### Right Section (ค่าอื่นๆ ของงาน)

- [x] ย้าย field grid เดิม (assignee, tester, status, priority, phase, start/due date, estimate, milestone, customer, labels) จากรายการบนลงมาเป็นคอลัมน์ขวา
- [x] เปลี่ยน field grid เป็นคอลัมน์เดียว (`space-y-4`) เพราะพื้นที่ขวาแคบลง
- [x] responsive: 2 คอลัมน์เฉพาะ `lg:` ขึ้นไป, ต่ำกว่านั้น stack เดิม (title/desc มาก่อน values)

### Section เดิมด้านล่าง

- [x] Subtasks section + Dependencies section + "Save as template" คงไว้ full-width ใต้ 2 คอลัมน์เหมือนเดิม (ไม่ย้ายเข้าขวา)

---

## Phase 2: SubtaskModal — Same Pattern

- [x] กว้าง modal + split layout เดียวกับ Phase 1 (parent breadcrumb + parent task + title + description ฝั่งซ้าย; status, estimate, assignee, tester, dates, labels ฝั่งขวา)
- [x] ใช้ class/โครงสร้างเดิมกับ TaskModal (ไม่สร้าง component ใหม่ — ก๊อป pattern, YAGNI ตามจำนวนครั้งที่ซ้ำจริง)

---

## Phase 3: Review & Quality Assurance

- [x] รัน e2e ที่เกี่ยว: `tests/e2e/task-crud.spec.ts`, `tests/e2e/templates.spec.ts` (คง `data-testid` เดิม เช่น `task-title` ห้ามเปลี่ยน) — 6 tests passed
- [ ] ตรวจด้วยตา: desktop (lg+) เห็น 2 คอลัมน์ / mobile ไม่มี scroll ซ้ำซ้อน, tab Comments/Attachments/Activity ไม่เลื่อนตำแหน่ง — ยังไม่ได้ทำ manual visual review
- [x] รัน `bun run typecheck` (ผ่าน)

---

## Appendix — Context Research

**ไฟล์ที่กระทบ (template-only refactor, ไม่มี state/logic เปลี่ยน)**

| ไฟล์ | จุดแก้ |
|---|---|
| `app/components/tasks/TaskModal.vue` | L682–687 (modal width), L706–834 (details tab → 2 คอลัมน์) |
| `app/components/tasks/SubtaskModal.vue` | L271–276, L292–388 |

**โครงสร้างที่เสนอ**

```
<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
  <div class="space-y-4">  ← template/parent, title, description(rows↑)
  <div class="space-y-4">  ← assignee … labels (คอลัมน์เดียว)
</div>
<subtasks / dependencies / save-as-template>  ← full-width เดิม
```

**ขอบเขต "ref:jiraa"** — ยืนยันแล้วว่าเป็น *design reference* (Jira-style form) ไม่ใช่ Jira integration:
- ไม่เพิ่ม field `jira_ref` / ไม่ทำ DB migration / ไม่แตะ schema (ยืนยันโดย user แล้ว)
- ถ้าอนาคตต้องการ Jira issue key field จริง = งาน net-new (migration + types + i18n) → แยก plan ต่างหาก

**ข้าม (add when needed)**
- Section header ย่อยในคอลัมน์ขวา (People / Schedule / Attributes) — เพิ่มเมื่อ field ขวาล้นจนอ่านยาก
- Shared `FormSection` component — repo ยังไม่มี และซ้ำแค่ 2 ที่
