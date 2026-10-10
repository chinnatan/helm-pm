# Runbook: รัน migration 035 บน production (Remove / Leave member)

> [ADR 0002](../adr/0002-hard-remove-workspace-member.md) — เพิ่ม RPC `remove_workspace_member` และ trigger กัน admin คนสุดท้าย
> ไม่แก้ schema ตาราง ไม่ล้างข้อมูล ย้อนกลับได้ด้วย SQL ด้านล่าง

## ก่อนรัน
- [ ] `supabase migration list --linked` ต้องมี 001–034 ครบ และรอแค่ 035
- [ ] ตรวจว่าไม่มี workspace ที่ไม่มี admin เลย (trigger ใหม่ไม่แก้ข้อมูลเก่า แต่จะกันการลบ/ลด admin คนสุดท้ายหลังจากนี้):
  ```sql
  select w.id, w.name from workspaces w
  where not exists (select 1 from workspace_members m where m.workspace_id = w.id and m.role = 'admin');
  ```

## รัน
```bash
supabase db push --linked --dry-run   # ต้องเห็นเฉพาะ 035
supabase db push --linked
```
ลำดับ: push migration ก่อน deploy เว็บ (เว็บเก่าไม่เรียก RPC นี้ จึงปลอดภัย)

## ตรวจหลังรัน
- [ ] หน้า Team: admin เห็นปุ่ม "นำออกจากทีม" ในการ์ดสมาชิก (ยกเว้น admin คนสุดท้าย)
- [ ] นำสมาชิกทดสอบออกพร้อมโอนงาน แล้วเช็กว่างานย้ายและ status ไม่เปลี่ยน

## Rollback
```sql
drop function if exists public.remove_workspace_member(uuid, uuid, uuid);
drop trigger if exists workspace_members_protect_last_admin on public.workspace_members;
drop function if exists public.protect_last_workspace_admin();
```
(สมาชิกที่ถูกนำออกไปแล้วกู้คืนไม่ได้ ต้องเชิญใหม่)

## ข้อควรรู้
- การลบบัญชีผู้ใช้ที่เป็น admin คนเดียวของ workspace จะถูก trigger บล็อก (ต้องโอน admin ก่อน)
