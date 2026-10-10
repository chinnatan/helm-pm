# Remove Member — นำสมาชิกออกจากทีม (Workspace)

## Business Goals

- admin นำ Member ที่ไม่อยู่ทีมแล้วออกจาก Workspace ได้เอง โดยงานไม่ค้างชื่อคนที่ออก
- Member ออกจากทีมเองได้ (Leave) ด้วยกฎเดียวกัน
- Workspace ไม่เคยเหลือไร้ admin
- ประวัติเดิม (คอมเมนต์, activity) ไม่พัง แสดงเป็น "อดีตสมาชิก"

ตัดสินใจแล้ว: ดู `CONTEXT.md` (Member / Remove / Leave / Former member) และ `docs/adr/0002-hard-remove-workspace-member.md`

---

## Phase 1: Database (migration 035)

### RPC `remove_workspace_member`

- [x] สร้าง `035_remove_workspace_member.sql` (ทดสอบบน DB local ใน transaction ที่ rollback: โอนงาน+focus+notification สรุป, admin คนสุดท้ายถูกบล็อก, non-admin ถูกปฏิเสธ, Leave ผ่าน) — function `remove_workspace_member(p_workspace_id, p_user_id, p_transfer_to uuid default null)` แบบ `SECURITY DEFINER` + atomic
- [x] เช็คสิทธิ์: caller เป็น admin ของ workspace หรือ `p_user_id = auth.uid()` (Leave)
- [x] บล็อกถ้าเป็น admin คนสุดท้าย (raise exception)
- [x] ตรวจ `p_transfer_to` ต้องเป็น Member ของ workspace เดียวกัน role admin/manager/member (ไม่ใช่ viewer) และไม่ใช่คนที่ถูกนำออก
- [x] โอน/เคลียร์ `tasks.assignee_id`, `tasks.tester_id`, `subtasks.assignee_id`, `subtasks.tester_id` ใน workspace นี้ (โอนให้ `p_transfer_to` หรือ NULL) โดยไม่เปลี่ยน status
- [x] ลบ `user_task_preferences` (focus/pin) ของคนนั้นเฉพาะ Task ใน workspace นี้
- [x] ลบแถว `workspace_members`
- [x] ส่ง notification สรุปครั้งเดียวให้ผู้รับโอน ("ได้รับโอนงาน N ชิ้นจาก X") และข้าม notification รายงานของ trigger เดิมระหว่างโอน

### Trigger กัน admin คนสุดท้าย

- [x] เพิ่ม trigger BEFORE DELETE/UPDATE บน `workspace_members` กันการลบหรือลด role ของ admin คนสุดท้าย (ครอบคลุมทางลัดที่ไม่ผ่าน RPC)

### ตรวจ trigger เดิม

- [x] ยืนยันว่า audit trigger `member_removed` (015) ยังทำงานและเก็บ email snapshot — ทดสอบแล้วทำงาน (หมายเหตุ: การลบทั้ง workspace ล้มเหลวอยู่แล้วเพราะ trigger นี้เขียน audit_log ที่ FK ชี้ workspace ที่ถูกลบ ไม่เกี่ยวกับงานนี้ ไม่ได้แก้)

---

## Phase 2: Composable & UI

### `useWorkspace`

- [x] เพิ่ม `removeMember(userId, transferTo?)` เรียก RPC แล้ว `fetchMembers()` ใหม่
- [x] เพิ่ม `countOpenWorkFor(userId)` ใช้นับงานเปิดของคนนั้นในหน้าต่างยืนยัน (reuse `countsFor` ถ้ามีข้อมูลอยู่แล้ว)

### หน้า `team/index.vue`

- [x] เพิ่มปุ่ม "นำออกจากทีม" ในแถว Member (เห็นเฉพาะ admin และไม่แสดงกับ admin คนสุดท้าย)
- [x] เพิ่มปุ่ม "ออกจากทีม" ของตัวเอง (ซ่อน/ปิดถ้าเป็น admin คนสุดท้าย)
- [x] หน้าต่างยืนยัน: แสดงจำนวนงานเปิด + ตัวเลือกผู้รับโอน (admin/manager/member) หรือ "ปล่อยว่าง"
- [x] หลัง Leave ให้ล้าง workspace state และพาไป workspace อื่นหรือหน้า no-workspace เดิม

### แสดง "อดีตสมาชิก"

- [x] จุดแสดงชื่อ: ไม่สร้าง helper แยก ใช้ fallback `t("team.formerMember")` inline ตรงจุดที่แสดงชื่อ (4 จุด) — ข้อสรุป: ไม่ต้องมี unit test ของ helper
- [x] ใช้ใน comments/activity (`useCollaboration.ts`, `useTasks.ts` บรรทัด profile join) และ actor ใน `useAuditLog.ts` (ใช้ label snapshot ถ้ามี)
- [x] เพิ่ม i18n `team.removeMember`, `team.leaveTeam`, `team.removeConfirm`, `team.transferTo`, `team.leaveUnassigned`, `team.formerMember` ทั้ง `en.json` + `th.json`

---

## Phase 3: Review & Quality Assurance

- [x] unit test: helper ชื่ออดีตสมาชิก — ไม่ต้องทำ (ไม่มี helper ใช้ fallback inline)
- [x] e2e `tests/e2e/remove-member.spec.ts`: โอนงาน, ปล่อยว่าง, ไม่มีปุ่มกับ admin คนสุดท้าย (ผ่าน 3/3) — non-admin ถูกปฏิเสธที่ DB (ทดสอบแล้วใน Phase 1) และ Leave ตัวเองไม่มี e2e เพราะต้อง login เป็น user ที่สอง จึงครอบคลุมด้วยเทส SQL
- [x] รัน analyzer/typecheck และ test ตาม scope
- [x] เพิ่มขั้นตอนรัน migration 035 ใน `docs/runbooks`

---

## Appendix: ผล research

| เรื่อง | ข้อเท็จจริง |
|---|---|
| สิทธิ์ลบเดิม | policy `Admins can delete members` (004) อนุญาตเฉพาะ admin แต่ UI `canManageMembers` รวม manager |
| UI เดิม | `useWorkspace.ts` มีแค่ `updateMember`, `team/index.vue` ไม่มีปุ่มลบ |
| Assignee | `tasks.assignee_id`, `tester_id`, `subtasks.assignee_id/tester_id` ชี้ `profiles` (SET NULL) ลบ membership ไม่แตะ จึงต้องเคลียร์เอง |
| Team focus | เก็บใน `user_task_preferences` (PK user_id+task_id) ไม่ผูก workspace โดยตรง ต้อง join `tasks` เพื่อกรองเฉพาะ workspace นี้ |
| ชื่อในประวัติ | policy profiles ใช้ `shares_workspace_with` คนที่ออกแล้วชื่อหายจาก join ใน `useCollaboration`, `useTasks` (383/393), `useAuditLog` |
| Capacity | **ไม่ต้องทำ** `member_month_capacities` ถูก DROP ใน 031 (Q6 ไม่มีผล) |
| active workspace | `resolveActiveWorkspaceId` เช็ค membership และ fallback เองอยู่แล้ว |
| คำเชิญ | คงไว้ตามที่ตกลง ไม่ต้องแก้ |
| Notification | trigger เดิม (021/025) แจ้งเมื่อ assignee เปลี่ยน ต้องข้ามระหว่างโอน แล้วส่งสรุปเอง (`notifications.task_id` เป็น nullable ใช้ได้) |
