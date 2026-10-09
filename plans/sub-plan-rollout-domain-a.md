# Rollout Domain Reset (ก้อน A) — โมเดล Customer × Feature × Commitment และหน้าเมทริกซ์ภาพรวม

## Business Goals

- เห็นภาพรวมในหน้าเดียวว่า ลูกค้าไหน ฟีเจอร์ไหน อยู่สถานะใด เดือนไหน (เลิกจด Timeline ใน Obsidian)
- Task ผูก Customer/Feature ได้แบบไม่บังคับ และมองย้อนจากเมทริกซ์ลงมาหา Task ได้
- เก็บประวัติการเลื่อนเดือน Commitment เพื่อตอบลูกค้าได้
- คำศัพท์ในโค้ด/UI ตรงกับ `CONTEXT.md` และการตัดสินใจใน ADR 0001

---

## Phase 1: Data Model (Supabase migration 031)

### สำรองและเคลียร์ข้อมูลเดิม
- [ ] export ข้อมูลเดิม (projects, tasks, customers, meetings, requirements) เป็น JSON ไว้ใน `reports/` ก่อน migrate — **ต้องทำก่อนรัน 031 บน production** (ยังไม่ได้ทำ ไม่ได้แตะ DB จริง)
- [x] ลบข้อมูลโดเมนเดิมที่ไม่ใช้แล้ว — เก็บ customers/labels/templates/dependencies ไว้ (migration 031 ทดสอบบน local Supabase แล้ว ยังไม่ได้รันบน production) (projects, milestones, meetings, requirements, member_month_capacities, workspace_month_calendars) ใน migration

### ตารางใหม่
- [x] สร้าง `features` (workspace_id, name, color, archived, sort_order; unique ต่อ workspace + name)
- [x] สร้าง `rollouts` (workspace_id, customer_id, feature_id, status: planned/developing/testing/production/cancelled; unique customer_id + feature_id)
- [x] สร้าง `commitments` (rollout_id, month `date` ชี้ต้นเดือน, status เป้าหมาย; unique rollout_id + month)
- [x] สร้าง `commitment_reschedules` (commitment_id, from_month, to_month, reason, created_by, created_at)
- [x] RLS ทั้ง 4 ตารางตามรูปแบบ `workspace_members` เดิม (manage = admin/manager, read = สมาชิก)

### ปรับ `tasks`
- [x] ทำ `project_id` ออกจาก tasks — เพิ่ม `workspace_id` NOT NULL แทน (RLS/`task_workspace_id` ใช้คอลัมน์นี้) (drop) และเพิ่ม `feature_id` nullable, คง `customer_id` nullable
- [x] เพิ่ม `task_type` (feature/bug/infra/customer-request) และเปลี่ยนชุด status เป็น inbox/todo/in_progress/testing/done/cancelled
- [x] ปรับ trigger/function ที่อ้าง — เขียนใหม่ 5 functions เป็น workspace_id และ log customer_id/feature_id แทน milestone `project_id`, `phase`, milestone (`log_task_changes`, dependency cycle, notifications) ให้ทำงานได้โดยไม่มีคอลัมน์เหล่านั้น
- [x] ตัดคอลัมน์/ตาราง SDLC phase และ milestone_id ออก

## Phase 2: Composables

- [x] `useFeatures.ts` — list/create/update/archive ตาม pattern `useCustomers`
- [x] `useRollouts.ts` — fetch เมทริกซ์ (rollouts + commitments + จำนวน Task เปิดอยู่ต่อ rollout), ตั้ง/เปลี่ยน status — รวมนับ Task เปิดต่อ rollout (key `customerId:featureId`)
- [x] `useCommitments.ts` — สร้าง, เลื่อนเดือนพร้อมเหตุผล (เขียน `commitment_reschedules`) — เลื่อนเดือนไม่เป็น transaction (ย้อนเดือนกลับถ้าบันทึกประวัติล้มเหลว) มี `ponytail:` comment ระบุเพดาน
- [x] ปรับ `useTasks.ts` ให้กรองตาม customer_id / feature_id แทน project_id และรองรับ `task_type` — กรองระดับ workspace, `subscribeToWorkspace`, เพิ่ม `TaskFilters`
- [x] ลบ `useProjects.ts`, `useLastProject.ts`, `useTeamCapacity.ts`, `useMemberMonthCapacities.ts`, `useCapacityAlerts.ts`, `useWorkspaceMonthCalendar.ts` และจุดอ้างอิง — ลบ composables 6 ตัว + `useMilestones`, meetings/requirements ใน `useCustomers`, `useTaskCardDisplay` เขียนใหม่ไม่พึ่ง project

## Phase 3: หน้าเมทริกซ์ภาพรวม (หน้าแรก)

### Matrix view
- [x] หน้า `/` แสดงแถว Customer × คอลัมน์เดือน; ช่องแสดง Feature/Rollout พร้อมสีตาม Rollout status และจำนวน Task เปิด
- [x] คลิกช่องเปิด panel รายละเอียด Rollout: Commitment ของเดือนนั้น, ประวัติเลื่อน, รายการ Task
- [x] ปุ่มสลับแกนเป็น Feature × เดือน
- [x] ส่วน "ยังไม่ผูก" แสดง Task ที่ไม่มี Customer และ/หรือ Feature — แสดงเป็นข้อความจำนวนงาน (ยังไม่ลิงก์ไปรายการ — รอหน้ารายการ Task ใน Phase 4)

### จัดการ Rollout/Commitment
- [x] ฟอร์มสร้าง Rollout (เลือก Customer + Feature) และตั้ง Rollout status — `RolloutCreateModal` (ยังไม่ได้ทดสอบ interaction ใน browser; render/สร้างผ่าน DB ปกติ)
- [x] ฟอร์มเพิ่ม/เลื่อน Commitment (บังคับกรอกเหตุผลเมื่อเลื่อน) — เพิ่ม/เลื่อน/ลบใน `RolloutPanel` ทดสอบเลื่อนเดือนจริงบน local แล้ว (เก็บประวัติถูกต้อง)

### หน้า settings
- [x] หน้าจัดการ Feature (เพิ่ม/แก้ชื่อ/สี/archive/เรียงลำดับ) — `/settings/features` (เพิ่ม/เปลี่ยนชื่อ/เรียง/archive; สีใช้ค่าอัตโนมัติ ยังไม่มีตัวเลือกสี)

## Phase 4: Task UI ปรับตามโมเดลใหม่

- [x] ฟอร์ม task: เลือก Customer และ Feature (ไม่บังคับ), ประเภท task, ตัดช่อง project/milestone/phase — `TaskModal` ใช้ `defaultCustomerId/defaultFeatureId` จาก scope ของหน้า
- [x] list/board ของ task ย้ายจาก `projects/[id]/*` เป็นหน้ากรองระดับ workspace (customer/feature/type/assignee) — `/tasks/board`, `/tasks/list` (+ `/tasks` redirect) ใช้ `useTaskScope` เก็บ customer/feature/type ใน URL query; `NotificationBell` ลิงก์ `/tasks/board?task=`; `usePlanner` ปรับเป็น workspace_id
- [x] ปรับ Kanban ให้ใช้ status ชุดใหม่ และ Bulk actions/Task Template ให้ใช้ฟิลด์ใหม่ — Bulk actions/Task Template ผ่านการปรับ status/phase แล้ว (ยังไม่ทดสอบ bulk ใน browser)
- [x] ตัด Gantt, Calendar view และ phase badge ที่ผูก project/milestone (เลื่อน Calendar ตามที่ตกลง) — ลบ `app/pages/projects/*`, `components/gantt`, `ProjectHeader/Nav`; ยังเหลือ package `frappe-gantt` ใน dependencies (ถอดใน Phase 5)

## Phase 5: ตัดของที่ไม่ใช้

- [x] ลบหน้า/คอมโพเนนต์ Meetings, Requirements, Capacity (`app/components/capacity`, ส่วนใน customers/[id]) และ i18n ที่เกี่ยวข้อง — ลบ `components/capacity`, ถอด meetings/requirements ออกจาก `customers/[id]` (เขียนใหม่ให้แสดง Rollout + งานค้าง), `team` เหลือ tab สมาชิกพร้อมนับงานค้าง/เลยกำหนด; ลบ i18n ที่ไม่ใช้ (~290 keys/ภาษา) ตรวจแล้วไม่มี key ที่ code อ้างแต่หาย; คอลัมน์ `workspace_members.weekly_capacity_hours` ยังอยู่ใน DB (ต้อง migration แยกถ้าจะลบ)
- [x] ปรับ Dashboard เดิมที่อ้าง project/milestone: ลบหรือแทนด้วยเมทริกซ์ (ตัดสินใจตอนทำ) — ลบ `pages/dashboard` ทิ้ง (เมทริกซ์ที่ `/` แทนแล้ว), ถอด `frappe-gantt`, ลบ `utils/capacityCalendar.ts` และ types/ฟังก์ชัน capacity ที่ไม่ใช้
- [x] อัปเดต `PLAN.md` ให้ตรงกับฟีเจอร์ที่เหลือ — เขียนหัวข้อ Customers/Features/Rollouts, Tasks, Views ใหม่ และตัด Capacity/ตารางเก่าออก

## Phase 6: Review & Quality Assurance

- [x] ปรับ/ลบ unit และ e2e tests — unit: ลบ `phase.test.ts`, ปรับ dependency/templates, เพิ่ม `rollout.test.ts` (addMonths/monthInputToStart/toMonthStart); e2e: ย้ายไป `/tasks/*`, เพิ่ม `rollouts.spec.ts` (เมทริกซ์, เลื่อนเดือนต้องมีเหตุผล, งานยังไม่ผูก) และ `features.spec.ts` ที่อ้าง project/milestone/phase และเพิ่ม test สำหรับ rollouts, commitments, การเลื่อนเดือน, Task ที่ไม่ผูก
- [x] รัน typecheck, vitest และ playwright — typecheck 0 errors, vitest 20 ผ่าน, playwright 16 ผ่าน (บน Supabase local)
- [x] นำเข้าข้อมูลจริงจาก `Timeline.md` — ลองนำเข้า SJC/TNT (13 Rollout + งานของ TNT) ลง Supabase local ด้วย SQL ครั้งเดียว (ไม่ได้เก็บใน repo) หน้าเมทริกซ์ใช้แทน Timeline.md ได้; ข้อสังเกต: ลูกค้าที่ยังไม่มี Rollout (เช่น Siam Aisin) ไม่ปรากฏในเมทริกซ์ (SJC/TNT) เพื่อทดสอบว่าใช้แทน Obsidian ได้

---

## Appendix: Research

**ข้อค้นพบที่กระทบแผน**
- `tasks.project_id` เป็น `NOT NULL` (migration 001) — Inbox/งานไม่ผูกทำไม่ได้จนกว่าจะ drop
- trigger ที่ผูกกับ phase/dependency (migration 029) และ `log_task_changes` ต้องตรวจก่อน drop คอลัมน์
- Task Dependencies: ตัดสินใจแล้ว เก็บตารางและ trigger ไว้ ตัดเฉพาะ UI Gantt
- Dashboard เดิม: ตัดสินใจแล้ว แทนด้วยเมทริกซ์

**สถานะหลัง Phase 2:** `app/composables`, `app/types` และ unit tests ผ่าน typecheck/vitest; `database.ts` แก้มือให้ตรง schema 031 ส่วน typecheck ที่เหลือ (~150 errors) อยู่ใน pages/components ที่ต้องแก้ใน Phase 3–5 (`projects/*`, `TaskModal`, `KanbanBoard`, `TaskCard`, `GanttChart`, `dashboard`, `customers/[id]`, `team`, capacity, i18n)

**สถานะหลัง Phase 3:** หน้า `/` เป็นเมทริกซ์แล้ว, nav เปลี่ยนเป็น Overview/Planner/Customers/Team/Features/Audit, redirect หลัง login ไป `/`, ลบ `ProjectSwitcher`; ทดสอบด้วย Supabase local + Chrome (ดู screenshot ชั่วคราว ไม่ได้เก็บไว้) ส่วนที่ยังรอ Phase 4–5: `projects/*`, `dashboard`, `customers/[id]`, `NotificationBell` (ยังลิงก์ `/projects/...`), i18n เก่า

**สถานะหลัง Phase 4:** typecheck เหลือ 31 errors เฉพาะ `customers/[id]`, `dashboard`, `team`, `components/capacity` (Phase 5); unit tests ผ่าน; ทดสอบ board/list/modal บน local ด้วย Chrome แล้ว (e2e เดิมยังอ้าง project — Phase 6)

**สถานะหลัง Phase 5 (Phase 6 เสร็จตามด้านบน ยกเว้นข้อ export สำรองก่อนรัน production):** `nuxt typecheck` 0 errors, vitest 16 tests ผ่าน; ทดสอบ `customers/[id]` และ `team` บน local แล้ว; เหลือ Phase 6 (e2e เดิมยังอ้าง project, นำเข้าข้อมูลจริงจาก `Timeline.md`)

**นอกขอบเขตก้อน A** (ก้อน B, C ตามลำดับที่ตกลง): Quick capture + Inbox + Team focus; Customer response + export Issue Log + ลิงก์แชร์อ่านอย่างเดียว

**ข้อควรตัดสินใจก่อนเริ่ม**
- Task Dependencies: เก็บหรือตัด? (ผมแนะนำเก็บตาราง ตัด UI ก่อน)
- Subtasks: เก็บตามเดิม (Team focus ใน ก้อน B ใช้ต่อ)
