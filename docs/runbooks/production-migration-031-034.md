# Runbook: รัน migration 031–034 บน production

> เป้าหมาย: เปลี่ยนโดเมนเป็น Rollout/Commitment ([ADR 0001](../adr/0001-rollout-centric-domain-reset.md)) บนฐานข้อมูล Supabase จริง (`ymkgraummbuearuhkesa`)
> **ย้อนกลับไม่ได้ด้วย SQL** — migration 031 ล้างข้อมูล tasks เดิมทั้งหมด การถอยกลับทำได้ด้วยการ restore จาก backup เท่านั้น

## สถานะที่ตรวจแล้ว (read-only)

- `supabase migration list --linked`: production มี 001–030 และ **รอ 031, 032, 033, 034**
- `supabase db push --linked --dry-run`: จะ push 4 ไฟล์นี้ตามลำดับเท่านั้น ไม่มี seed/roles
- **ซ้อมบนข้อมูลจำลอง** (schema ≤030 + ข้อมูลครบทุกตาราง ดู `rehearsal-seed-old-schema.sql`): migration ทั้ง 4 ไฟล์ผ่านโดยไม่มี error, trigger/function แจ้งเตือนและ activity log ใช้งานได้หลัง migrate, status ของ template ถูก map ถูกต้อง
- ข้อจำกัดของการซ้อม: ข้อมูลจำลองมีขนาดเล็ก — ยังไม่ได้ลองกับข้อมูลจริง (ดูขั้นตอน 2)

## ข้อมูลที่จะหาย / คงอยู่

| ถูกล้าง (ไม่มีทางกู้นอกจาก backup) | คงอยู่ |
|---|---|
| tasks, subtasks, task_labels, task_dependencies | workspaces, workspace_members, profiles |
| comments, attachments (แถวใน DB — ไฟล์ใน Storage bucket `attachments` **ยังค้าง** เป็น orphan) | customers, labels |
| activity_log, user_task_preferences (pin/focus) | task_templates (status ถูก map: backlog→inbox, ready_for_test→testing, release→done, ตัด phase) |
| **notifications ทั้งหมด** และ notification_deliveries (ตารางอ้าง tasks → ถูก truncate ทั้งตาราง) | audit_log, invites, avatars |
| projects, milestones, meetings, requirements, member_month_capacities, workspace_month_calendars (ตารางถูก drop) | |

## ลำดับที่ปลอดภัย

โค้ดใหม่กับ schema ใหม่ต้องมาคู่กัน: เว็บเก่าพังหลัง migrate และเว็บใหม่พังก่อน migrate จึงมีช่วงสั้น ๆ ที่ใช้งานไม่ได้ — **นัดช่วงที่ไม่มีคนใช้และแจ้งทีมก่อน**

### 0. ก่อนเริ่ม
- [ ] เช็กใน Cloudflare Pages ว่า build จาก `develop` อัตโนมัติหรือไม่ (push `3658c22` ขึ้น remote แล้ว) — ถ้าใช่ เว็บจริงอาจได้โค้ดใหม่ไปแล้วตอนนี้ ให้รัน migration โดยเร็ว หรือ rollback deployment เป็น commit `caa1520` จนกว่าจะพร้อม
- [ ] แจ้งทีมว่าข้อมูลงานเดิมจะถูกล้าง (เริ่มใหม่ตาม ADR 0001) และเก็บอะไรที่ต้องการไว้ก่อน
- [ ] ล็อกอิน Supabase CLI แล้ว (`supabase login`) และ link โปรเจกต์ถูกต้อง (`supabase status`/`supabase/.temp/project-ref`)

### 1. Backup (บังคับ)
```bash
mkdir -p backups
supabase db dump --linked -f backups/prod-pre031-$(date +%Y%m%d-%H%M).sql          # schema + data (ใช้ Docker)
supabase db dump --linked --data-only --use-copy -f backups/prod-pre031-data-$(date +%Y%m%d-%H%M).sql
ls -lh backups/        # ตรวจว่าไฟล์ไม่ว่าง และเปิดดูท้ายไฟล์ว่าจบสมบูรณ์
```
- [ ] เก็บไฟล์ไว้นอก repo (โฟลเดอร์ `backups/` ถูก gitignore แล้ว) และสำเนาอีกที่หนึ่ง
- [ ] เปิด Supabase Dashboard → Database → Backups ยืนยันว่ามี backup/PITR ล่าสุด (สำรองอีกชั้น)
- [ ] (ถ้าต้องการอ่านง่าย) export ตารางสำคัญเป็น CSV จาก Dashboard → Table editor: `tasks`, `projects`, `customers`

### 2. ซ้อมกับข้อมูลจริง (แนะนำ)
```bash
supabase db reset --local --version 030        # local กลับไปที่ schema เก่า
# restore dump จาก production เข้า local (ปรับ path/ชื่อไฟล์) — ตัวอย่าง:
docker exec -i supabase_db_helm-pm psql -U postgres -v ON_ERROR_STOP=0 < backups/prod-pre031-data-*.sql
supabase migration up --local                   # ต้องผ่านทั้ง 031–034 โดยไม่มี error
```
ข้อมูล auth ของ production อาจชนกับ local — ถ้า restore ไม่สะอาด ให้ข้ามขั้นตอนนี้หรือซ้อมแค่ตารางที่ migration แตะ (tasks, task_templates, notifications) ผลที่ต้องเห็น: `supabase migration list --local` ขึ้น 034, ไม่มี error

### 3. รัน migration
```bash
supabase db push --linked --dry-run             # ต้องเห็นเฉพาะ 031–034
supabase db push --linked                       # ยืนยัน prompt
supabase migration list --linked                # ต้องเห็น remote ครบถึง 034
```
- ถ้ามี error กลางทาง: **หยุด** ดูว่าไฟล์ไหนค้างด้วย `supabase migration list --linked` แล้วแก้/restore ตามหัวข้อ Rollback อย่ารันซ้ำสุ่มสี่สุ่มห้า

### 4. Deploy โค้ด
```bash
bun run deploy                                  # เว็บ (Cloudflare Pages) — หรือรอ build อัตโนมัติถ้าเชื่อม Git ไว้
task notifications:deploy                       # worker: เอา capacity cron ที่อ้าง projects/project_id ออกแล้ว
```
Worker เวอร์ชันเก่ายังรัน cron รายชั่วโมงที่ query `projects` — หลัง migrate จะ error เงียบ ๆ จึงควร deploy worker ใหม่ในรอบเดียวกัน

### 5. ตรวจหลัง deploy
SQL (Dashboard → SQL editor):
```sql
select count(*) from tasks;                                  -- 0 (เริ่มใหม่)
select count(*) from customers;                              -- เท่าเดิม
select to_regclass('public.projects');                       -- null
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('features','rollouts','commitments','commitment_reschedules','customer_share_links'); -- 5 ตาราง
select proname from pg_proc where proname = 'get_customer_share';
```
ใช้งานจริง: login → หน้า `/` ขึ้นเมทริกซ์ว่าง → เพิ่มฟีเจอร์ที่ `/settings/features` → สร้าง Rollout → กด `c` จดงานด่วน → เปิด `/team` เห็นแท็บ "ทีมกำลังทำอะไร" → สร้างลิงก์แชร์ที่หน้าลูกค้าแล้วเปิดในหน้าต่าง incognito → เพิกถอนแล้วเปิดไม่ได้

### 6. ใส่ข้อมูลเริ่มต้น
- นำเข้า Timeline จริงของ SJC/TNT: `reports/obsidian-import-sjc-tnt.sql` (ไฟล์ในเครื่อง ไม่ได้อยู่ใน git เพราะมีชื่อลูกค้าจริง) แก้อีเมลบรรทัด `u.email = '...'` ให้เป็นของคุณ แล้วรันใน SQL editor
- ลบไฟล์ใน Storage bucket `attachments` ที่กลายเป็น orphan (ถ้าไม่ต้องการ)

## Rollback
ไม่มีสคริปต์ย้อน schema (031 ลบตารางและข้อมูล) ทำได้ 2 ทาง:
1. restore database จาก backup ก่อน 031 (Supabase Dashboard → Database → Backups/PITR หรือ `psql` restore ไฟล์ใน `backups/`) แล้ว **redeploy เว็บและ worker เป็น commit `caa1520`** (ก่อนการรื้อ) — ข้อมูลที่เกิดหลัง migrate จะหาย
2. ถ้า migrate สำเร็จแต่โค้ดมีบั๊กเล็ก ๆ: แก้ไปข้างหน้าด้วย migration ใหม่ ไม่ต้อง restore

## หมายเหตุ
- `workspace_members.weekly_capacity_hours` ยังอยู่ใน DB (ไม่ได้ใช้แล้ว) ลบได้ด้วย migration แยกภายหลัง
- เว็บใช้ `SUPABASE_URL`/`SUPABASE_KEY` ของ production ใน env ของ Cloudflare — ไม่ต้องเปลี่ยน
