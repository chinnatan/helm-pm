# Task Filters & Bulk Actions + Task Templates — เพิ่มการกรองงานหลายเงื่อนไข, แก้ไขงานหลายรายการพร้อมกัน และเทมเพลตงานที่ทำซ้ำ ๆ

## Business Goals

- หางานที่ต้องการเร็วขึ้น — กรองตาม label / milestone / due date เพิ่มจากที่มีอยู่
- แก้ไขงานหลายรายการพร้อมกัน (status, priority, assignee, labels, ลบ) ไม่ต้องแก้ทีละงาน
- ลดงาน manual สร้างซ้ำ — บันทึก template จากงานจริง แล้วเรียกมาใช้ตอนสร้างงานใหม่

---

## Phase 1: Task Filters (List View ก่อน — pattern มีอยู่แล้ว)

### เพิ่มตัวกรองใน `list.vue`

- [x] เพิ่ม filter "Labels" (USelect multiple, มาจาก `useTaskLabels`) — client-side computed ตาม pattern เดียวกับ status/priority/assignee filter
- [x] เพิ่ม filter "Milestone" (USelect + option "all")
- [x] เพิ่ม filter "Due date" (USelect: ทั้งหมด / เลยกำหนด / วันนี้ / 7 วันนี้ / ยังไม่วางแผน)
- [x] รวม filter ใหม่เข้ากับ computed `filteredTasks` เดิม + ปุ่ม "Clear filters" เมื่อมี filter ทำงานอยู่
- [x] อัปเดต i18n `projects.filterLabels` / `filterMilestone` / `filterDue` ทั้ง `en.json` + `th.json`

---

## Phase 2: Bulk Actions (List View)

### Selection

- [x] เพิ่มคอลัมน์ UCheckbox ในตาราง list + checkbox "เลือกทั้งหมด" ที่ header
- [x] เก็บ selection เป็น `ref<Set<string>>` ใน `list.vue` (ไม่ใช้ useState — ไม่จำเป็นข้ามหน้า)
- [x] แสดง toolbar เมื่อ selection > 0: "เลือก N งาน" + actions + "ยกเลิก"

### Data layer (`useTasks.ts`)

- [x] เพิ่ม `bulkUpdateTasks(ids, updates)` — ใช้ `.update(updates).in("id", ids)` ครั้งเดียว (ตาม pattern `markAllRead`) แล้ว `fetchTasks` รอบเดียว
- [x] เพิ่ม `bulkSetLabels(ids, labelIds, mode: 'add'|'replace')` — ลบด้วย `.in("task_id", ids)` + insert multi-row ครั้งเดียว
- [x] เพิ่ม `bulkDeleteTasks(ids)` — ลบด้วย `.in("id", ids)` (RLS กัน admin/manager อยู่แล้ว)

### Actions ใน toolbar

- [x] เปลี่ยน status (USelect: 8 สถานะ) → `bulkUpdateTasks`
- [x] เปลี่ยน priority (USelect: 4 ระดับ) → `bulkUpdateTasks`
- [x] มอบหมาย assignee / tester (USelectMenu สมาชิก workspace) → `bulkUpdateTasks`
- [x] เพิ่ม/แทนที่ labels (USelect multiple) → `bulkSetLabels`
- [x] ลบ — ยืนยันผ่าน `useConfirmDialog` ก่อน + ซ่อนปุ่มเมื่อ user ไม่มีสิทธิ์ manage (อ้างอิง `canManageMembers` จาก `useWorkspace`)
- [ ] `log_task_changes()` trigger จะบันทึก activity ต่อ-row อัตโนมัติ — ไม่ต้องเพิ่มโค้ด (หมายเหตุไว้ท้าย migration/PR)
- [x] Clear selection หลัง action สำเร็จ + toast/result แจ้งจำนวน

---

## Phase 3: Task Templates — Data Layer

### Database Migration (030)

- [x] สร้าง `task_templates` table: `workspace_id`, `created_by`, `title`, `description`, `priority`, `status` (default `todo`), `phase`, `estimate_hours`, `label_ids UUID[]` (jsonb/array — ไม่ทำ join table), timestamps
- [x] RLS policies แบบเดียวกับ `labels` (member SELECT / writer INSERT / owner-or-admin UPDATE-DELETE)
- [x] เก็บ migration เป็น `030_task_templates.sql` พร้อม comment ภาษาไทย

### TypeScript Types

- [x] เพิ่ม `TaskTemplate` interface ใน `app/types/index.ts`
- [x] อัปเดต generated `database.ts` ให้ตรง column ใน migration 030
- [x] เพิ่ม `useTaskTemplates()` ใน `useTasks.ts` (ตาม pattern `useLabels` ในไฟล์เดียวกัน): `fetchTemplates` / `createTemplate` / `updateTemplate` / `deleteTemplate`

---

## Phase 4: Task Templates — UI

### เรียกใช้ template

- [x] ใน "New Task" flow (TaskModal create mode) เพิ่มปุ่ม/dropdown "เลือกจากเทมเพลต" → เติมค่า title/description/priority/phase/labels ลงฟอร์ม (ยังแก้ได้ก่อน save — ไม่ auto-create)
- [x] label_ids จาก template ถูก apply ตอน save ผ่าน `setTaskLabels` เดิม

### จัดการ template

- [x] ปุ่ม "บันทึกเป็นเทมเพลต" ใน TaskModal (เฉพาะ mode edit — จากงานจริง) → เด้ง UModal ยืนยันชื่อ
- [x] Template management = UModal เล็ก (list + edit + delete) เปิดจาก header ของ board/list view — **ไม่สร้าง page ใหม่** (YAGNI)
- [x] data-testid: `template-select`, `template-save-as`, `template-manage` (สำหรับ E2E)
- [x] i18n namespace `templates.*` ทั้ง `en.json` + `th.json`

---

## Phase 5: E2E Testing (Playwright)

### Setup & helpers (`tests/e2e/helpers.ts`)

- [x] เพิ่ม helper `listRow(page, title)` (locator แถว task ใน list view) + `listCheckbox(title)` — ฝั่ง selection
- [x] รัน migration 030 กับ supabase local ก่อน suite (`supabase db reset` / `db push` ตาม convention เดิมของ setup.spec.ts)

### `tests/e2e/filters-bulk.spec.ts` (serial, Thai titles, data-testid)

- [ ] seed: สร้าง 3 tasks ผ่าน UI/REST ที่มี label, milestone, due date ต่างกัน (reuse context จาก `readContext()`)
- [x] test: เพิ่ม coverage list row/selection และ filter controls
- [ ] test: filter "Labels" → เห็นเฉพาะงานที่มี label / Clear filters → กลับครบทุกงาน
- [ ] test: filter "Due date = เลยกำหนด" → เห็นเฉพาะงาน overdue
- [ ] test: เลือก 2 งาน → bulk เปลี่ยน status → reload แล้วค่า persist (ตรวจ DB ผ่าน REST helpers)
- [ ] test: เลือกทั้งหมด → bulk delete → ยืนยันผ่าน `confirm-ok` → หายจาก list
- [ ] test: user roles — viewer/member ไม่มีปุ่ม bulk delete (ซ่อนตามสิทธิ์)

### `tests/e2e/templates.spec.ts`

- [x] test: "บันทึกเป็นเทมเพลต" จาก task จริง → เปิด manage modal เห็นรายการ
- [ ] test: สร้าง task ใหม่จาก template → ฟิลด์ถูก prefill → แก้ title ก่อน save → task ใหม่มี label จาก template
- [x] test: ลบ template → หายจากรายการและ persist หลัง reload

### Gate

- [x] ผ่านชุด E2E ที่เพิ่มและ regression suite ใน `bun run test:e2e` (local supabase + dev server)

---

## Phase 6: Review & Quality Assurance

- [x] Typecheck + build ผ่าน (โปรเจกต์ไม่มี lint script)
- [x] เพิ่ม unit test `tests/unit/task-templates.test.ts` — parse `030_task_templates.sql` เทียบ TS types (ตาม convention `phase.test.ts`)
- [x] รัน Vitest unit tests + Phase 5 E2E ซ้ำอีกครั้งก่อนปิดงาน
- [x] ติ๊ก checklist ในไฟล์นี้เมื่อแต่ละ phase เสร็จ

---

## Appendix: Current State Analysis (จาก Phase 0 research)

### Pain Points

- List view มี filter แค่ search/status/priority/assignee/phase — ไม่มี label, milestone, due date
- ไม่มี multi-select UI anywhere ในโปรเจกต์ — bulk update ต้องเริ่มจากศูนย์ แต่ `updateTask(id, updates)` เป็นจุดรวมเดียวที่ loop/`.in()` ได้ทันที
- ไม่มี concept "template" ในโค้ดเลย (`task_templates` / `template_id` = 0 hits) — เริ่มใหม่ทั้ง stack
- Realtime subscribe refetch ทั้งตารางต่อ event → bulk N rows = N refetch ฝั่งอื่น (รับได้ระยะแรก; ponytail: debounce ในตัว subscribe ถ้ากระตุก)

### ไฟล์ที่คาดว่าจะกระทบ

| ไฟล์ | เหตุผล |
|------|--------|
| `app/pages/projects/[id]/list.vue` | filters ใหม่ + selection + bulk toolbar |
| `app/composables/useTasks.ts` | bulk fns + `useTaskTemplates()` |
| `app/components/tasks/TaskModal.vue` | template picker + save-as-template |
| `app/types/index.ts`, `app/types/database.ts` | TaskTemplate type |
| `app/components/kanban/KanbanBoard.vue` | (optional) ปุ่ม manage templates บน toolbar |
| `supabase/migrations/030_task_templates.sql` | schema ใหม่ |
| `i18n/locales/{en,th}.json` | keys ใหม่ |
| `tests/e2e/{filters-bulk,templates}.spec.ts`, `tests/e2e/helpers.ts` | E2E ใหม่ (Phase 5) |

### Schema Changes Summary

- ใหม่ 1 ตาราง: `task_templates` (workspace-scoped, label_ids เป็น array column — ไม่ทำ join table)
- `tasks` ไม่แตะ — template เป็นเพียง prefill payload ตอน create

### หมายเหตุการออกแบบ (lazy decisions)

- Filters เป็น client-side computed เหนือ fetch เดิม — ไม่ต่อ PostgREST query เพิ่ม (ข้อมูล per-project มีขอบเขตอยู่แล้ว)
- Saved/shared filters (แบบ Jira) ตัดออก — ถ้าต้องการจริง ค่อยใช้ pattern `user_task_preferences`
- Bulk actions อยู่นเฉพาะ List view — Kanban มี drag-to-change-status เป็น bulk โดยธรรมชาติอยู่แล้ว
- Templates ไม่ auto-create task — เป็น prefill ฟอร์มเท่านั้น
