# นำ Member ออกด้วยการลบแถวจริง ไม่ใช้ soft delete

การ Remove Member ลบแถว `workspace_members` จริงใน RPC เดียวแบบ atomic (เฉพาะ admin, ห้ามนำ admin คนสุดท้ายออก) โดยโอนหรือปล่อยว่างงานที่ค้าง (assignee/tester/Team focus) ก่อน ผลคือ policy ดู profile (`shares_workspace_with`) จะซ่อนชื่อคนนั้นในประวัติ UI จึงแสดง "อดีตสมาชิก" แทน

## Considered Options

- Soft delete (`removed_at`): ถูกปฏิเสธ เพราะต้องแก้ทุก policy/query ที่นับสมาชิก ทั้งที่ระบบยังเล็ก และ UNIQUE (workspace_id, user_id) ทำให้เชิญกลับมาได้อยู่แล้ว
- ปล่อย assignee ค้างชื่อคนที่ออก: ถูกปฏิเสธ เพราะงานไม่มีเจ้าของจริง

## Consequences

- ประวัติ (คอมเมนต์, activity) ระบุตัวคนที่ออกไม่ได้ มีแค่ audit log (`member_removed`) ที่เก็บ email snapshot
- ย้อนกลับไม่ได้ ต้องเชิญใหม่ และสิทธิ์/job role/Team focus เดิมไม่กลับมา
