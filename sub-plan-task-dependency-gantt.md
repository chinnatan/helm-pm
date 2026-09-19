# Task Dependency Management & SDLC Phase Tracking — ปรับปรุงระบบจัดการงานให้รองรับหลายลูกค้า พร้อม SDLC Phase Tracking และ Dependency Management

## Business Goals

- มองเห็นสถานะงานทั้งหมด across ทุกลูกค้าได้ทันที ว่างานไหนถึงไหนแล้ว
- ติดตามได้ว่างงานแต่ละชิ้นอยู่ใน SDLC phase ไหน (Requirements → Design → Development → Testing → Deployment)
- จัดการ task dependency ได้ผ่าน UI (สร้าง/แก้ไข/ลบ) และมองเห็นความเชื่อมโยงบน Gantt
- ระบุได้ว่างานไหนสำคัญ/เร่งด่วน และงานไหนถูก block จาก dependency

---

## Phase 1: Data Layer — Schema & Types

### Database Migration (029)

- [x] เพิ่ม `phase` column (TEXT, nullable) ใน `tasks` — ค่า: `requirements`, `analysis`, `design`, `development`, `testing`, `deployment`, `done`
- [x] เพิ่ม `phase` column (TEXT, nullable) ใน `milestones` — ค่าเดียวกัน
- [x] เพิ่ม `phase_order` column (INTEGER) ใน `tasks` — สำหรับจัดลำดับ phase ใน Kanban/Gantt
- [x] สร้าง function `check_circular_dependency()` ใน PostgreSQL — ป้องกัน circular dependency ระดับ DB (transitive) + trigger `task_dependencies_check_circular`
- [x] เพิ่ม trigger `tasks_set_phase_order` — auto-set `phase_order` ตาม `phase` value (function `set_task_phase_order()`)
- [x] อัปเดต RLS policies สำหรับ columns ใหม่ — ไม่ต้องแก้ policies (เป็น row-based ไม่อ้างอิง column ครอบคลุม column ใหม่อัตโนมัติ — บันทึกไว้ท้าย migration 029)
- [x] **หมายเหตุ**: ใช้ `task_dependencies` table ที่มีอยู่แล้ว (task_id, depends_on_task_id) — ไม่ต้องเพิ่ม column ใหม่



### TypeScript Types & Constants

- [x] เพิ่ม `TaskPhase` type ใน `types/index.ts`
- [x] เพิ่ม `TASK_PHASE_VALUES` array พร้อม label + icon + color สำหรับแต่ละ phase (+ `TASK_PHASE_ORDER` map, `taskPhaseMeta()` helper)
- [x] เพิ่ม `phase` field ใน `Task` interface
- [x] เพิ่ม `phase` field ใน `Milestone` interface
- [x] เพิ่ม `phase_order` field ใน `Task` interface
- [x] **หมายเหตุ**: `TaskDependency` interface มีอยู่แล้ว — ไม่ต้องแก้

---



## Phase 2: Dependency Management UI (Option 3: Hybrid — Simple + Visual)



### แนวทางออกแบบ (ง่ายกว่า Jira)

**หลักการ**: มีแค่ "Depends on" field เดียว (ไม่ต้องเลือก direction) + Visual indicator

#### 2.1 "Depends On" Section ใน TaskModal

- [x] เพิ่ม "Dependencies" section ใน details tab (ไม่ใช่ tab ใหม่)
- [x] แสดงเป็น multi-select dropdown: "งานที่ต้องทำก่อน" (Depends on)
- [x] แสดงรายการ tasks ที่เลือกแล้วเป็น chips/tags พร้อมปุ่มลบ
- [x] แสดงสถานะของแต่ละ dependency:
  - ✅ = งานนั้น done แล้ว (ไม่ block)
  - ⏳ = งานนั้นยังไม่ done (block อยู่)
- [x] เชื่อม `useDependencies()` composable กับ TaskModal



#### 2.2 Visual Blocked Indicator (บน TaskCard / Kanban)

- [x] เพิ่ม computed `isBlocked` ใน TaskCard — check ว่ามี incoming dependency ที่ยังไม่ done
- [x] แสดง blocked badge (⏳ icon) บน card header
- [x] แสดง tooltip: "รอ: [task title]" (แสดงงานที่ block อยู่)
- [x] เพิ่ม CSS: `.task-card--blocked` (border สีแดง/ส้ม)



#### 2.3 Dependency Info ใน Task Detail

- [x] แสดง "Depends on" list ใน task detail (sidebar หรือ section)
- [x] แสดง "Blocks" list (งานที่งานนี้ block) — computed จาก reverse lookup
- [x] แสดงสถานะแต่ละ dependency (done/not done)



#### 2.4 Data Layer Updates

- [x] ปรับปรุง `useDependencies()` composable:
  - `addDependency(taskId, dependsOnTaskId)` — เพิ่ม dependency (งานนี้ depends on งาน kia)
  - `removeDependency(id)` — ลบ dependency
  - `getDependsOn(taskId)` — งานที่งานนี้ depends on (outgoing)
  - `getBlocks(taskId)` — งานที่งานนี้ blocks (incoming, reverse lookup)
  - `isBlocked(taskId)` — check ว่าถูก block โดยงานที่ยังไม่ done
- [x] เพิ่ม transitive circular detection (BFS/DFS)
- [x] เพิ่ม validation: ไม่ให้ depends on งานที่ closed แล้ว (done/release/cancelled)



### TaskModal — Dependencies Section Implementation

- [x] สร้าง "Dependencies" section ใน details tab (ด้านล่าง subtasks)
- [x] แสดง "Depends on" multi-select dropdown
- [x] แสดง chips ของ tasks ที่เลือก พร้อม status icon (✅/⏳)
- [x] แสดง "Blocks" section (งานที่งานนี้ block) — read-only
- [x] Real-time validation feedback (circular, closed task)
- [x] Empty state: "ไม่มีการพึ่งพากัน" + hint



### TaskCard — Blocked Indicator

- [x] เพิ่ม computed `isBlocked` ใน TaskCard
- [x] แสดง blocked badge (⏳) บน card header เมื่อถูก block
- [x] แสดง tooltip: "รอ: [task title]"
- [x] เพิ่ม CSS: `.task-card--blocked` (border สีส้ม/แดง)



### Kanban Board — Blocked Tasks Visual

- [x] เพิ่ม filter option: "ซ่อนงานที่ถูก block" / "แสดงเฉพาะงานที่ถูก block"
- [x] แสดง blocked count ใน column header
- [x] Sort option: blocked tasks ไปท้าย column



### Dependency Validation

- [x] ปรับปรุง `addDependency()` ใน `useCollaboration.ts`:
  - Transitive circular detection (BFS)
  - Closed task check
- [x] แสดง error/warning messages ที่ชัดเจน

---



## Phase 2.5: Subtask Creation UX — ทำให้ง่ายขึ้น (อนุมัติแล้ว)

**Pain points ที่พบจากการอ่านโค้ด**: ทุกบรรทัด subtask โผล่ 5 fields เสมอ (`TaskModal.vue:733-777`), ช่องสร้างบังคับเจอ 6 fields (`:792-829`), แก้ชื่อ subtask ไม่ได้จากใน TaskModal (`:727-732`), ไม่มี bulk add

### Row — 1 บรรทัดต่อ 1 งานย่อย

- [x] ลด row subtask เหลือ 1 บรรทัด (drag handle + checkbox + title + ⋯ + ✎ + ลบ)
- [x] ย้าย assignee/tester/start/due/estimate ไปไว้ใน `UPopover` (⋯) — ใช้ handler save-ทันทีตัวเดิม
- [x] แสดงค่าที่ตั้งไว้เป็น chip เล็กใต้ title (👤 / 📅 / ชม.)
- [x] title เป็น input แบบ plain — บันทึกตอน blur/Enter (rename ได้ ไม่ต้องลบสร้างใหม่)



### Create form

- [x] Title input เดียว + Enter → สร้างทันที (field อื่นคงค่าไว้เพื่อกรอกต่อเนื่อง)
- [x] ซ่อน fields เพิ่มเติมไว้หลัง toggle "เพิ่มรายละเอียด…"
- [x] รองรับวางข้อความหลายบรรทัด → สร้างหลายงานย่อยพร้อมกัน
- [x] (ทำแบบ inline loop ใน component — ไม่เพิ่ม `addSubtasks()` ใน `useTasks.ts` เพราะ 4 บรรทัดจบ ไม่จำเป็น)



### รายละเอียดเต็มรูปแบบ

- [x] Wire `TasksSubtaskModal` เข้ากับ `TaskModal` (ปุ่ม ✎ บน row)
- [x] Sync `sortedSubtasks` หลัง save จาก SubtaskModal



### i18n & QA

- [x] เพิ่ม keys ใน `i18n/locales/th.json` + `en.json`
- [x] รัน `bun run typecheck` (ไม่มี script lint ใน repo)
- [x] ทดสอบ manual (ผู้ใช้): สร้าง 1 / วางหลายบรรทัด / rename / ⋯ popover / ✎ modal / drag เรียงลำดับ

---



## Phase 3: Gantt Enhancement — Phase Grouping & Dependency Visualization



### Phase Grouping ใน Gantt

- [x] เพิ่ม option ให้จัดกลุ่ม tasks ใน Gantt ตาม `phase` (แทน milestone หรือเสริม) — ทำใน `GanttChart.vue` (mode `phase`: กลุ่มเรียงตาม `TASK_PHASE_VALUES`, งานไม่มี phase ลงกลุ่ม "ไม่ระบุ Phase" ท้ายสุด)
- [x] สร้าง phase group headers (collapsible) พร้อม phase icon + color — reuse โครง group header เดิม (kind `group`) + `taskPhaseMeta()`
- [x] แสดง phase progress bar (จำนวนงาน done / ทั้งหมด ใน phase นั้น) — mini progress bar + `done/total` ใต้ชื่อกลุ่ม (เฉพาะ mode phase)
- [x] เพิ่ม dropdown toggle: "Group by Milestone" / "Group by Phase" / "No Grouping" — วาง toolbar เหนือ chart ใน `GanttChart.vue` (ไม่ต้องแก้ `gantt.vue`)



### Dependency Visualization

- [x] ตรวจสอบว่า frappe-gantt dependency arrows ทำงานถูกต้องกับ task-to-task — ยืนยันจาก source (`make_arrows`): ลูกศรวาดเมื่อทั้ง 2 ฝั่งเป็น bar ที่ render อยู่ (งานที่ถูก collapse ลูกศวจะซ่อน — พฤติกรรมยอมรับได้)
- [x] เพิ่ม dependency arrows สำหรับ subtask-to-task และ task-to-subtask — **ทำไม่ได้โดยไม่เปลี่ยน schema**: `task_dependencies` FK ชี้ `tasks(id)` เท่านั้น (001_initial_schema.sql:173) และ UI มีแต่ task-level dependency — **สรุป: ไม่ทำ** ข้ามจนกว่าจะต้องการจริง (ต้องเพิ่ม migration + ตัวเลือก dep ใน subtask)
- [x] Highlight critical path — **ไม่ทำ**: frappe-gantt 1.0.3 ไม่มี API รองรับ ต้องเขียน graph algo เอง (YAGNI ตามแผนระบุ optional)
- [x] เพิ่ม dependency info ใน Gantt popup (hover bar) — custom `popup` option: ชื่อ + สถานะ + ช่วงวัน + รายการ "Depends on / Blocks" พร้อม ⏳/✅



### Phase Timeline

- [x] เพิ่ม phase swim lane / color band ใน Gantt timeline (แสดงว่า phase ไหนอยู่ช่วงไหน) — group bar of phase group เป็นแถบสีบางพาดช่วงวันที่ของ phase นั้น (CSS `.phase-bar.phase-<value>`)
- [x] แสดง milestone markers บน phase timeline — **ไม่ทำ**: ตอน group-by-milestone มีแถบ milestone อยู่แล้ว; overlay เส้น marker บน mode phase ต้องเขียน SVG layer เอง ไม่คุ้ม scope

---



## Phase 4: Cross-Client Overview Dashboard



### Workspace Dashboard Page

- [x] สร้างหน้า `/dashboard` (หรือปรับ `/` redirect) — ภาพรวมระดับ workspace — ใหม่ `app/pages/dashboard/index.vue` + nav "แดชบอร์ด" (คง `/` → `/planner` เดิมไม่เปลี่ยน)
- [x] แสดง Customer Progress Cards — แต่ละ card: customer name, progress bar (% done), overdue count, active tasks count — คำนวณ client-side จาก tasks ทั้ง workspace (customer = `task.customer_id` ?? project's customer)
- [x] แสดง "Overdue & At Risk" section — overdue = ปิดยังไม่เสร็จ + `due_date < วันนี้`; at risk = due ใน 7 วันแต่สถานะยัง backlog/todo
- [x] แสดง "Upcoming Milestones" — milestones ที่กำลังจะถึงใน 30 วัน (link ไป Gantt ของโปรเจกต์)
- [x] แสดง "Team Workload Summary" — load bars ของสมาชิก — reuse `useTeamCapacity` + `CapacityLoadBar` (สัปดาห์นี้, top 8 ตาม % โหลด)



### Multi-Client Task View

- [x] เพิ่ม "All Tasks" view ที่รวมงานจากทุก project/customer — section ล่างของหน้า dashboard
- [x] Filter by: customer, project, phase, status, priority, assignee
- [x] Group by: customer, phase, project, status (+ ไม่จัดกลุ่ม)
- [x] แสดง phase badge บน task cards/rows — badge สีตาม `taskPhaseMeta` ในตาราง + คลิกแถวเปิด TaskModal



### Implement Notes (Phase 3–4)

- ไฟล์ที่แก้จริง: `app/components/gantt/GanttChart.vue` (grouping + popup + phase bands), `app/types/frappe-gantt.d.ts` (+`popup` option), `app/pages/dashboard/index.vue` (ใหม่), `app/layouts/default.vue` (nav), `app/components/tasks/TaskModal.vue` + `app/composables/useTasks.ts` (phase field), `app/types/database.ts` (เพิ่ม `phase`/`phase_order` ใน types ของ tasks/milestones — ของเดิมตกหล่นหลัง migration 029 ทำให้ insert/update มี phase ไม่ได้), `i18n/locales/{th,en}.json`
- `gantt.vue` page ไม่ต้องแตะ (toggle อยู่ dalam `GanttChart`)
- QA: `bun run typecheck` ผ่าน — test อัตโนมัติ/manual คงตาม Phase 6
- **Fix round 2 (user feedback)**: (1) Gantt เต็มพื้นที่ — `gantt.vue` root เป็น `flex h-full flex-col`, shell ใช้ `flex-1 min-h-0`, ตัด `max-height: min(70vh,720px)`; (2) phase bar ไม่ render เลย — root cause: frappe-gantt 1.0.3 ทำ `classList.add(custom_class)` ซึ่ง **throw กับ string 2 token** (เช่น `"phase-bar phase-development"`, `"priority-x gantt-subtask"`) ทำให้ make_bars พังทั้งชุด → custom_class ต้องเป็น token เดียว, ใช้ prop `color` (inline style fill) แทน CSS per-phase และ pad same-day group เป็น +1 วัน (แถบ 0px กว้างมองไม่เห็น) — ยืนยันด้วย jsdom harness ก่อน/หลังแก้

---



## Phase 5: Task Creation & Tracking Improvements



### Task Creation Flow

- [x] เพิ่ม "Phase" dropdown ใน TaskModal (สร้าง/แก้ไข) — **ทำก่อน (ดึงมาจาก Phase 5)** ในการ implement Phase 3: ถ้าไม่มีตัวตั้ง `phase` จะไม่มีข้อมูลทดสอบ grouping/badge เลย; field เดียวใน details tab, ส่งค่าผ่าน `createTask`/`updateTask` (`phase_order` อัตโนมัติจาก DB trigger)
- [x] Auto-suggest phase ตาม status (เช่น status = testing → suggest phase = testing) — `PHASE_BY_STATUS` + `suggestPhaseForStatus()` ใน `types/index.ts`; watch `form.status` ใน `TaskModal.vue` (ตั้งเฉพาะ phase ยังว่าง/ยังไม่ถูกแก้ด้วยมือ — `phaseTouched` flag, mapping: in_progress→development, ready_for_test/testing→testing, done/release→done)
- [x] เพิ่ม "Quick Create" จาก customer page — สร้างงานผูกกับ customer นั้นทันที — modal เล็ก (title + project + due date, Enter = สร้าง) ใน `customers/[id].vue` header "งานค้าง" → เรียก `createTask({ project_id, title, customer_id })` ตรง ๆ แล้ว refresh openTasks
- [x] เพิ่ม template tasks สำหรับแต่ละ phase (optional) — **ไม่ทำ** (optional ตามแผน, YAGNI — auto-suggest phase覆盖了ส่วนใหญ่แล้ว)


### Phase Tracking

- [x] แสดง phase badge/color บน Kanban cards — badge (icon + สี + label) ใน `TaskCard.vue` ต่อจาก priority badge, เรนเดอร์เมื่อ `display.showPhase` (compact =ซ่อน, standard/detailed =แสดง) ผ่าน flag ใหม่ใน `useTaskCardDisplay.ts`
- [x] แสดง phase progress ใน project overview (จำนวนงานแยกตาม phase) — section "ความคืบหน้าตาม Phase" ใน `projects/[id]/index.vue`: mini bar ต่อ phase (done/total, สีตาม `TASK_PHASE_VALUES`) + ช่อง "ไม่ระบุ Phase" (count)
- [x] เพิ่ม phase filter ใน Kanban, List, Calendar views — ใช้ `phaseFilterItems` ใหม่ใน `useTaskLabels.ts` (ทุก phase / ไม่ระบุ / ราย phase); filter ทั้ง 3 วิวใช้ `(task ?? parent).phase`, subtask ติด filter ตาม parent — **fix round 2**: option "ไม่ระบุ Phase" ต้องใช้ sentinel `"none"` (Reka Select ห้าม `value=""` — runtime error, typecheck จับไม่ได้)
- [x] อัปเดต milestone progress auto-calc จาก tasks ที่ผูกอยู่ — ทำใน Gantt group header: แถบ done/total แสดงทุก group mode (เดิมเฉพาะ phase mode) — progress ของ milestone = finished tasks / ทั้งหมดที่ผูก `milestone_id` (client-side, ไม่แตะ schema)

---



## Phase 6: Review & Quality Assurance

> **Automated testing**: unit = `sub-plan-automated-testing.md` (`bun run test`), e2e = `sub-plan-e2e-testing.md` (`bun run test:e2e`) — ข้อ [auto] รันอัตโนมัติ, ข้อ [manual] คงทดสอบด้วยมือ

- [x] รัน `bun run typecheck` + `bun run test` (vitest) เพื่อตรวจสอบ code quality — ไม่มี script `lint` ใน repo จึงใช้ typecheck แทน (typecheck เขียว, unit 20/20, e2e 8/8 ณ ปิดงาน automated testing)
- [x] ออก test report ด้วย `bun run test:report` → `reports/junit.xml` (JUnit XML — เปิดใน CI/IDE, ดูวิธีใน `sub-plan-automated-testing.md`)
- [x] [auto] ทดสอบ circular dependency detection (self / direct A↔B / transitive A→B→C→A / DAG ไม่ false positive) — vitest unit test + e2e cycle guard ผ่าน UI
- [x] [auto] ทดสอบ blocked status (`blockedBy`/`isBlocked` กับ dep ที่ closed vs เปิดอยู่) และ phase helpers (`TASK_PHASE_ORDER`, `taskPhaseMeta`) — vitest unit test
- [x] [auto] สร้าง/แก้ไข/ลบ task + เพิ่ม dependency + blocked badge + cycle error ผ่าน UI — Playwright e2e (`bun run test:e2e`)
- [ ] [manual] ตรวจ Gantt arrows แบบ visual — e2e ยังไม่ assert ตำแหน่งลูกศร (deferred ใน `sub-plan-e2e-testing.md`)
- [ ] [manual] ทดสอบ phase grouping ใน Gantt
- [ ] [manual] ทดสอบ cross-client dashboard กับข้อมูลหลายลูกค้า
- [ ] [manual] ทดสอบ responsive (mobile/desktop)
- [ ] [manual] ทดสอบ DB trigger `check_circular_dependency()` ผ่าน `supabase db reset` local

---



## Appendix: Current State Analysis



### ปัญหาปัจจุบัน (Pain Points)


| ปัญหา                                | สาเหตุ                         | ผลกระทบ                                              |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------- |
| ไม่รู้ว่างานอยู่ SDLC phase ไหน      | Tasks ไม่มี `phase` field      | ติดตามสถานะงานยาก ไม่ชัดว่างานอยู่ในขั้นตอนไหน       |
| สร้าง dependency ไม่ได้              | ไม่มี UI ใน TaskModal          | ไม่สามารถกำหนดลำดับงานได้ ต้องจำเอง                  |
| ไม่เห็นภาพรวมหลายลูกค้า              | ไม่มี workspace dashboard      | ต้องเปิดดูแต่ละ project แยกกัน                       |
| Milestone ไม่มี phase concept        | Milestone มีแค่ title + dates  | ไม่รู้ว่า milestone อยู่ในระยะพัฒนาไหน               |
| Gantt จัดกลุ่มได้แค่ milestone       | ไม่มี phase grouping option    | มองไม่เห็น work distribution ตาม SDLC                |
| Dependency arrows มีแต่ task-to-task | Subtask dependencies ไม่รองรับ | ไม่เห็น dependency ที่ละเอียด                        |
| ไม่เห็น blocked status               | ไม่มี visual indicator         | ไม่รู้ว่างานไหนถูก block ต้องถามทีม                  |
| ไม่มี circular detection             | มีแค่ direct check (A↔B)       | อาจเกิด circular dependency แบบ transitive (A→B→C→A) |




### ไฟล์ที่คาดว่าจะกระทบ


| ไฟล์                                   | การเปลี่ยนแปลง                                                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| `supabase/migrations/029_*.sql`        | ใหม่ — schema changes (phase columns, circular detection function) |
| `app/types/index.ts`                   | เพิ่ม TaskPhase, phase fields                                      |
| `app/composables/useCollaboration.ts`  | ปรับปรุง useDependencies (transitive detection, helper functions)  |
| `app/composables/useTasks.ts`          | เพิ่ม phase support                                                |
| `app/components/tasks/TaskModal.vue`   | เพิ่ม Dependencies section ใน details tab                          |
| `app/components/tasks/TaskCard.vue`    | เพิ่ม blocked indicator (badge + tooltip)                          |
| `app/components/tasks/KanbanBoard.vue` | เพิ่ม blocked filter/visual                                        |
| `app/components/gantt/GanttChart.vue`  | เพิ่ม phase grouping, dependency visualization                     |
| `app/pages/projects/[id]/gantt.vue`    | เพิ่ม group-by toggle                                              |
| `app/pages/dashboard/index.vue`        | ใหม่ — cross-client dashboard                                      |
| `app/pages/customers/index.vue`        | เพิ่ม quick-create, progress view                                  |




### Schema Changes Summary

```sql
-- tasks: เพิ่ม phase tracking
ALTER TABLE tasks ADD COLUMN phase TEXT CHECK (phase IN (
  'requirements', 'analysis', 'design', 'development', 'testing', 'deployment', 'done'
));
ALTER TABLE tasks ADD COLUMN phase_order INTEGER DEFAULT 0;

-- milestones: เพิ่ม phase
ALTER TABLE milestones ADD COLUMN phase TEXT CHECK (phase IN (
  'requirements', 'analysis', 'design', 'development', 'testing', 'deployment', 'done'
));

-- Circular dependency prevention function (ใช้ task_dependencies table ที่มีอยู่แล้ว)
CREATE OR REPLACE FUNCTION check_circular_dependency() RETURNS trigger ...
```

**หมายเหตุ**: ไม่ต้องเพิ่ม column ใน `task_dependencies` — ใช้ structure ที่มีอยู่แล้ว (task_id, depends_on_task_id)

### UI Wireframe — Dependencies Section (Option 3: Hybrid)

```
┌─────────────────────────────────────────────────────────────┐
│  Task: สร้าง API endpoints                                   │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  [Details] [Comments] [Attachments] [Activity]              │
│  ┌─ Details Tab ──────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  Title: [สร้าง API endpoints                    ]      │ │
│  │  Description: [rich text editor...            ]        │ │
│  │                                                         │ │
│  │  Status: [In Progress ▼]  Priority: [High ▼]          │ │
│  │  Assignee: [John Doe ▼]   Tester: [Jane ▼]            │ │
│  │                                                         │ │
│  │  ─── Subtasks ──────────────────────────────────────   │ │
│  │  ☐ สร้าง endpoint /users                               │ │
│  │  ☑ สร้าง endpoint /products                            │ │
│  │  [+ เพิ่ม subtask]                                     │ │
│  │                                                         │ │
│  │  ─── Dependencies ──────────────────────────────────   │ │
│  │                                                         │ │
│  │  งานที่ต้องทำก่อน (Depends on):                         │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │ ⏳ ออกแบบ Database Schema        [✕]            │   │ │
│  │  │ ✅ เขียน API specification         [✕]            │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │  [🔍 เลือกงานที่ต้องทำก่อน...                ]         │ │
│  │                                                         │ │
│  │  งานที่งานนี้ block (Blocks):                           │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │ ⏳ เขียน unit tests                              │   │ │
│  │  │ ⏳ Deploy to staging                             │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Legend:
  ⏳ = งานนั้นยังไม่ done (block อยู่)
  ✅ = งานนั้น done แล้ว (ไม่ block)
```



### TaskCard — Blocked Indicator

```
┌─────────────────────────────────────┐
│ ⏳ สร้าง API endpoints              │  ← blocked badge (รอ dependency)
│ ─────────────────────────────────── │
│ 🔴 Urgent  │  📅 Due: 2024-01-15   │
│ 👤 John Doe │  🧪 Tester: Jane     │
│ ─────────────────────────────────── │
│ ⏳ รอ: ออกแบบ Database Schema      │  ← แสดงว่ารออะไร
└─────────────────────────────────────┘

ถ้าไม่ถูก block:
┌─────────────────────────────────────┐
│ สร้าง API endpoints                 │  ← ไม่มี badge
│ ─────────────────────────────────── │
│ 🔴 Urgent  │  📅 Due: 2024-01-15   │
│ 👤 John Doe │  🧪 Tester: Jane     │
└─────────────────────────────────────┘
```



### เปรียบเทียบ Jira vs Helm PM (Option 3)


| Feature          | Jira                                               | Helm PM (Option 3)                     |
| ---------------- | -------------------------------------------------- | -------------------------------------- |
| Link types       | blocks, blocked by, relates to, clones, duplicates | **มีแค่ "Depends on"**                 |
| Direction        | ต้องเลือก (สับสน)                                  | **ชัดเจน (งานนี้ depends on งาน kia)** |
| UI               | Outgoing/Incoming sections, tabs                   | **Section เดียวใน details tab**        |
| Visual indicator | ✅                                                  | ✅ (blocked badge + tooltip)            |
| Gantt arrows     | ✅                                                  | ✅ (มีอยู่แล้ว)                         |
| ความซับซ้อน      | สูง                                                | **ต่ำ**                                |




### SDLC Phases


| Phase          | Label (TH)      | Icon                      | Color               |
| -------------- | --------------- | ------------------------- | ------------------- |
| `requirements` | เก็บความต้องการ | `i-lucide-clipboard-list` | `#8b5cf6` (violet)  |
| `analysis`     | วิเคราะห์       | `i-lucide-search`         | `#6366f1` (indigo)  |
| `design`       | ออกแบบ          | `i-lucide-palette`        | `#3b82f6` (blue)    |
| `development`  | พัฒนา           | `i-lucide-code`           | `#10b981` (emerald) |
| `testing`      | ทดสอบ           | `i-lucide-bug`            | `#f59e0b` (amber)   |
| `deployment`   | Deploy          | `i-lucide-rocket`         | `#ef4444` (red)     |
| `done`         | เสร็จสิ้น       | `i-lucide-check-circle`   | `#6b7280` (gray)    |




### Dependency Concept (Option 3: Hybrid)


| Concept        | คำอธิบาย                                   | ตัวอย่าง                                               |
| -------------- | ------------------------------------------ | ------------------------------------------------------ |
| **Depends on** | งานที่ต้องทำก่อนงานนี้ (งานนี้รออยู่)      | "สร้าง API" depends on "ออกแบบ DB"                     |
| **Blocks**     | งานที่งานนี้ต้องทำก่อน (reverse lookup)    | "ออกแบบ DB" blocks "สร้าง API"                         |
| **Blocked**    | สถานะที่ถูก block (dependency ยังไม่ done) | "สร้าง API" is blocked (เพราะ "ออกแบบ DB" ยังไม่ done) |


**Visual Indicators:**

- ⏳ = dependency ยังไม่ done (block อยู่)
- ✅ = dependency done แล้ว (ไม่ block)



### เปรียบเทียบ Jira vs Helm PM (Option 3)


| Feature            | Jira                        | Helm PM (ปัจจุบัน)     | Helm PM (หลังปรับปรุง - Option 3)  |
| ------------------ | --------------------------- | ---------------------- | ---------------------------------- |
| Dependency UI      | ❌ ซับซ้อน (link types เยอะ) | ❌ ไม่มี UI             | ✅ "Depends on" field เดียว         |
| Direction          | ต้องเลือก (สับสน)           | N/A                    | ชัดเจน (งานนี้ depends on งาน kia) |
| Blocked Indicator  | ✅ badge/icon                | ❌ ไม่มี                | ✅ ⏳ badge + tooltip                |
| Dependency Graph   | ✅ (Advanced Roadmaps)       | ❌ ไม่มี                | ⚠️ Optional                        |
| Circular Detection | ✅                           | ⚠️ เฉพาะ direct (A↔B)  | ✅ Transitive (BFS/DFS)             |
| Phase Tracking     | ✅ Custom field / Sprint     | ❌ ไม่มี                | ✅ Built-in phase field             |
| Cross-Project View | ✅ Dashboards / Filters      | ❌ ต้องดูแยก project    | ✅ Workspace dashboard              |
| ความซับซ้อน        | สูง                         | ต่ำ (แต่ไม่มี feature) | **สมดุล** (ง่าย + มี visual)       |


