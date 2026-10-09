# เปลี่ยนแกนโดเมนจาก Project/Milestone เป็น Rollout/Commitment และเริ่มข้อมูลใหม่

ระบบเดิมจัดงานตาม Customer → Project → Task (มี Milestone กับ SDLC Phase) ซึ่งตอบไม่ได้ว่า "ลูกค้าไหน ฟีเจอร์ไหน ถึงไหน เดือนไหน" ทำให้ผู้ใช้ไปจดใน Obsidian แทน เราจึงเปลี่ยนแกนเป็น Customer × Feature = Rollout, ใช้ Commitment (รายเดือน) แทน Milestone, ให้ Task ผูก Customer/Feature แบบไม่บังคับ และ **ไม่ย้ายข้อมูลเดิม** (เก็บ stack Nuxt + Supabase + auth + workspace)

## Considered Options

- เก็บ domain เดิมแล้วเพิ่ม layer ทับ: ถูกปฏิเสธ เพราะ `tasks.project_id` บังคับ และ Project ไม่ตรงกับ Feature/Rollout จึงต้องมีสองโมเดลซ้อนกัน
- ย้าย Task ที่ยังไม่ปิดเข้าโครงใหม่: ถูกปฏิเสธ เพราะข้อมูลเดิมไม่มี Feature ให้ map และผู้ใช้ไม่เชื่อถือข้อมูลนั้นอยู่แล้ว

## Consequences

- ต้อง export สำรองข้อมูลเดิมก่อน migrate เพราะย้อนกลับไม่ได้
- ตัด SDLC Phase, Meetings/Requirements, Capacity และเลื่อน Calendar/Web Push ออกไป
