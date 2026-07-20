# commit

ช่วยเขียน commit message ภาษาไทยแบบ Conventional Commits สำหรับ staged changes

## ขั้นตอน

1. รัน `git status` และ `git diff --staged` เพื่อดูไฟล์ที่ stage แล้ว
2. ถ้าไม่มี staged changes แจ้งผู้ใช้ให้ `git add` ก่อน แล้วหยุด
3. วิเคราะห์ diff แล้วเลือก type ที่เหมาะสม (`feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `test:`, `chore:`)
4. เขียน commit message **ภาษาไทย** ตามรูปแบบ `<type>: <คำอธิบาย>`
5. แสดง message ที่เสนอให้ผู้ใช้ copy ไปใส่ใน Source Control หรือ `git commit -m`

## กฎ

- ใช้ภาษาไทยเสมอ — ห้ามภาษาอังกฤษ
- ใช้ Conventional Commits type มาตรฐานเท่านั้น
- คำอธิบายสั้น กระชับ บอกสิ่งที่เปลี่ยนอย่างชัดเจน
- **อย่า commit ให้เอง** เว้นแต่ผู้ใช้ขอให้ commit โดยตรง
- ถ้ามีหลาย logical change แนะนำแยก commit

## ตัวอย่าง output

```text
feat: เพิ่ม validation จำนวนผู้เข้าร่วมการจองห้องอบรม
```

```text
fix: แก้ไขการ redirect หลังเปลี่ยนรหัสผ่านบังคับ
```
