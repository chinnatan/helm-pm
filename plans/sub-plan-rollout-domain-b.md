# Rollout Domain (ก้อน B) — Quick capture, Inbox และ Team focus

## Business Goals

- จดงานได้เร็วเท่า Obsidian (พิมพ์บรรทัดเดียวจากหน้าไหนก็ได้) แล้วจัดโครงทีหลัง จนไม่ต้องกลับไปจดนอกระบบ
- เห็นในหน้าเดียวว่า "ตอนนี้ใครทำอะไรอยู่" พร้อมลูกค้า/ฟีเจอร์ของงานนั้น
- งานที่ยังไม่ผูกลูกค้า/ฟีเจอร์ไม่หลุดหาย ไล่เก็บได้จาก Inbox

---

## Phase 1: Quick capture

### Parser (ฟังก์ชันล้วน ทดสอบด้วย unit test)
- [x] เพิ่ม `parseQuickCapture(text, customers, features)` ใน `app/utils/quickCapture.ts` — แยก `#tag` ออกจากชื่องาน แล้วจับคู่ลูกค้า/ฟีเจอร์แบบไม่สนตัวพิมพ์ (ชื่อ/บริษัทของลูกค้า, ชื่อฟีเจอร์ที่เปลี่ยน `_` เป็นช่องว่าง) — `app/utils/quickCapture.ts`; ผูกได้ลูกค้า 1 + ฟีเจอร์ 1 ต่อข้อความ tag ซ้ำชนิดเดิมคงไว้ในชื่องาน
- [x] tag ที่จับคู่ไม่ได้ให้คงอยู่ในชื่องาน ไม่ทิ้ง และ tag ที่กำกวม (ตรงหลายรายการ) ไม่ผูกอัตโนมัติ
- [x] เขียน `tests/unit/quickCapture.test.ts` ครอบ: ตรงลูกค้า, ตรงฟีเจอร์, ตรงทั้งคู่, ไม่ตรง, กำกวม, ไม่มี tag, ชื่อว่างหลังตัด tag — 11 เคส

### UI
- [x] สร้าง `QuickCaptureModal.vue` — ช่องพิมพ์เดียว แสดง chip ลูกค้า/ฟีเจอร์ที่จับคู่ได้แบบ live ก่อนกดบันทึก — insert ตรงด้วย supabase (ไม่ใช้ `useTasks().createTask` เพราะจะไปแก้ state งานของหน้าที่เปิดอยู่)
- [x] บันทึกเป็น Task สถานะ `inbox` ผ่าน `createTask` (ผูก customer_id/feature_id ตามที่จับคู่ได้) แล้วปิด modal พร้อม toast
- [x] ผูกคีย์ลัดและปุ่มลอยใน `layouts/default.vue` ให้เปิดได้ทุกหน้า (ไม่ทำงานตอนโฟกัสอยู่ในช่องพิมพ์) — คีย์ `c` (Nuxt UI ไม่ trigger ขณะพิมพ์ในช่อง input) + ปุ่มลอยมุมขวาล่าง
- [x] เพิ่ม i18n ไทย/อังกฤษ

## Phase 2: Inbox

- [x] เพิ่มตัวกรอง `unlinked=1` ใน `useTaskScope` / `useTasks` (customer_id หรือ feature_id เป็น null) และแสดงใน `TaskScopeBar` — นับเฉพาะงานที่ยังเปิด
- [x] ทำข้อความ "N งานยังไม่ผูก" บนหน้า `/` ให้เป็นลิงก์ไป `/tasks/list?unlinked=1`
- [x] แสดงจำนวนงานสถานะ `inbox` เป็น badge บนเมนู Tasks — `useInboxCount` ดึงใหม่เมื่อเปลี่ยนหน้า/หลังจดงาน
- [x] เปลี่ยนชื่อแท็บ "Inbox" ใน My Planner (ความหมายเดิมคือ "ยังไม่มีวันที่") เพื่อไม่ให้ชนกับ Task status `inbox` — เปลี่ยนป้ายเป็น "ไม่มีกำหนดวัน / No due date" (ค่า internal ยังเป็น `inbox`)

## Phase 3: Team focus

### Data (migration 032)
- [x] เพิ่ม policy ให้สมาชิก workspace อ่าน `user_task_preferences` ของคนอื่นได้ (เขียนได้เฉพาะของตัวเองตามเดิม) ผ่าน `task_workspace_id(task_id)` — migration 032; ทดสอบด้วย SQL ว่าสมาชิกอ่านของคนอื่นได้ แก้ไม่ได้ และคนนอก workspace อ่านไม่ได้
- [x] ปรับ `togglePin` ใน `usePlanner` ให้งานที่ pin ใหม่ได้ `sort_order` ถัดไปของผู้ใช้ (เดิมเป็น 0 ทุกงาน) และให้แท็บ Focus เรียงตาม `sort_order` — pin ใหม่ต่อท้ายลำดับ; แท็บ Focus เรียงตาม `sort_order` ของผู้ใช้

### UI
- [x] เพิ่ม `useTeamFocus.ts` — ดึงงานที่ pin ของสมาชิกทุกคน (เฉพาะงานที่ยังเปิด) จัดกลุ่มตามคน เรียงตาม `sort_order` — กรองเฉพาะงานที่เกี่ยวกับคนนั้นจริง (เหมือนแท็บ Focus ใน My Planner)
- [x] หน้า "ทีมกำลังทำอะไร" แสดงการ์ดต่อคน: งาน 1–3 ชิ้นแรกพร้อมลูกค้า/ฟีเจอร์/สถานะ และลิงก์เปิดงาน (งานที่เกิน 3 ยุบเป็น "+N") — `components/team/FocusBoard.vue`
- [x] ให้ผู้ใช้จัดลำดับ/เอางานออกจาก focus ของตัวเองได้จากหน้านี้ (ของคนอื่นอ่านอย่างเดียว) และเตือนเมื่อ focus เกิน 3 งาน — ปุ่มเลื่อนขึ้น/ลง/เอาออก (ไม่ใช่ drag)
- [x] เพิ่มเมนู/แท็บและ i18n — แท็บ "ทีมกำลังทำอะไร" เป็นแท็บเริ่มต้นของ `/team`

## Phase 4: Review & Quality Assurance

- [x] เพิ่ม e2e: quick capture สร้างงาน inbox พร้อมผูกลูกค้า/ฟีเจอร์จาก tag, ตัวกรอง `unlinked`, หน้า team focus เห็นงานที่ pin — `quick-capture.spec.ts` (3 เคส), `team-focus.spec.ts`
- [x] รัน `nuxt typecheck`, vitest และ playwright บน Supabase local — typecheck 0 errors, vitest 31, playwright 20 ผ่าน
- [x] อัปเดตหมายเหตุผลลัพธ์ในไฟล์นี้และ `PLAN.md`

---

## Appendix: Research

**ข้อค้นพบที่กระทบแผน**
- My Planner มีแนวคิด "Focus" (pin งานต่อคน) อยู่แล้วใน `user_task_preferences` (policy เดิมให้เห็นเฉพาะของตัวเอง, `sort_order` ถูกตั้งเป็น 0 ทุกครั้ง) จึงใช้เป็น Team focus ได้โดยไม่เพิ่มตาราง — ลดงานและไม่ให้มี "focus" สองชุด
- แท็บ "Inbox" ของ My Planner หมายถึงงานไม่มีวันครบกำหนด ซ้ำชื่อกับ Task status `inbox`
- Task status `inbox` มีคอลัมน์ใน Kanban และ CHECK constraint พร้อมแล้ว (migration 031)

**ตัดสินใจเรื่องที่ยังรอยืนยัน**
- Team focus ใช้ pin เดิม (แนะนำ) หรือสร้างตารางแยก
- คีย์ลัดเปิด Quick capture (แนะนำ `c` เมื่อไม่ได้โฟกัสช่องพิมพ์ + ปุ่มลอย)
- หน้า Team focus: แท็บใหม่ใน `/team` (แนะนำ) หรือเมนูแยก

**นอกขอบเขตก้อน B**
- วางหลายบรรทัด/markdown แตกเป็นหลาย Task (ตกลงไว้ว่าเป็นรอบถัดไป)
- Customer response, export Issue Log, ลิงก์แชร์ (ก้อน C)
