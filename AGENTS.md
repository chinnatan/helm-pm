# AGENTS.md — Agent Guide

## กระบวนการทำงานหลัก (Core Operating Workflow)

เมื่อได้รับมอบหมายฟีเจอร์ใหม่ การแก้บั๊ก หรือการ Refactor โค้ด **ห้ามเขียนโค้ดทันที** โดยจะต้องปฏิบัติตามลำดับขั้นตอนดังต่อไปนี้เสมอ

---

## Phase 0: Context Research & Requirement Breakdown

### ขั้นตอนที่ 1: การวิเคราะห์บริบทอย่างละเอียด (Deep Context Research)
ก่อนวางแผนหรือเขียนโค้ด ให้ทำการสำรวจบริบทและโค้ดเดิมในโปรเจกต์อย่างรอบคอบ

---

### ขั้นตอนที่ 2: แม่แบบการสร้าง Planning Checklist (Checklist Output Template)
สรุปผลการวิเคราะห์จากขั้นตอนที่ 1 และแตก requirement เป็น Checklist ตามแม่แบบด้านล่างนี้ (เสนอให้ user อนุมัติก่อน implement):

```markdown
# [ชื่อฟีเจอร์ / Requirement] — [คำอธิบายขอบเขตสั้น ๆ]

## Business Goals
- [เป้าหมายธุรกิจ/ผลลัพธ์ที่ 1 — ไม่ใส่ checkbox]
- [เป้าหมายที่ 2]

---

## Phase 1: [ชื่อ workstream / กลุ่มงาน]

### [ชื่อ subsection เช่น Category Navigation]
- [ ] [งานย่อยที่ทำได้จริง 1 ประโยค]
- [ ] [งานย่อยที่ 2]

### [ชื่อ subsection อื่น ถ้ามี]
- [ ] ...

## Phase 2: [ชื่อ workstream ถัดไป]

### [subsection]
- [ ] ...

## Phase N: Review & Quality Assurance
- [ ] รัน analyzer / ทดสอบตาม scope
```

**กฎการเขียน checklist**

1. **Business Goals** = ผลลัพธ์/เป้าหมาย — ใช้ bullet `-` ธรรมดา **ห้าม** `[ ]`
2. **Phase** = จัดตาม **workstream ของ requirement** ไม่บังคับ Domain/Data/UI ถ้างานไม่เกี่ยว
3. **`###` subsection** = กลุ่มงานย่อยใน Phase (เช่น Card Layout, Grid Layout, Rules)
4. **`- [ ]`** = ใช้เฉพาะงานที่ agent จะทำจริง — 1 บรรทัด 1 action
5. **Layer checklist** (Entity, Repository, Bloc ฯลฯ) — ใส่เป็น subsection ใน Phase ที่เกี่ยว **เมื่อ** งานเป็น feature ใหม่เต็ม stack เท่านั้น
6. **Context research** ทำใน Phase 0 แล้ว — **ไม่** ใส่ "วิเคราะห์ codebase" ซ้ำใน checklist ยกเว้น user ขอ

ผล research (ตารางเปรียบเทียบ, ไฟล์ที่กระทบ ฯลฯ) ใส่ใน Appendix ของ plan — ไม่ปนกับ checklist ที่ user อนุมัติ

---

## กฎการดำเนินงาน (Phase Execution Rules)

1. **ต้องได้รับอนุมัติจากผู้ใช้ก่อน**: เสนอรายการ Planning Checklist ที่ได้จาก Phase 0 ให้ผู้ใช้พิจารณา และรอการยืนยันก่อนเริ่มเขียนโค้ดเสมอ
2. **นโยบายแก้ไขข้อขัดแย้ง (Conflict Resolution Policy)**: หากงานที่ทำขัดแย้งกับกฎ (Rule) หรือ Skill ให้ระบุข้อขัดแย้งนั้น แล้วสอบถามผู้ใช้ว่าจะเลือก **(A)** ทำตาม Rule/Skill หรือ **(B)** ทำตามวิธีของผู้ใช้ (และอาจอัปเดต Rule/Skill เพิ่มเติม) ห้ามเพิกเฉยหรือข้ามข้อขัดแย้งโดยไม่แจ้งเด็ดขาด
3. **อัปเดตความคืบหน้าทีละขั้นตอน**: ติ๊กทำเครื่องหมายเสร็จสิ้น `[x]` ในรายการ Checklist ทันทีเมื่อทำงานย่อยนั้น ๆ เสร็จ
4. **อัปเดต Checklist ในไฟล์ plan เมื่อทำงานตาม plan เสร็จ**: หลังจาก implement จบแต่ละ phase/งานตามที่ได้รับมอบหมาย ให้กลับไปอัปเดต checklist (`[x]`) ในไฟล์ plan (เช่น `sub-plan-*.md`) พร้อมหมายเหตุผลลัพธ์/ข้อสรุปที่ไม่ต้องทำจริง ก่อนปิดงานทุกครั้ง
5. **Commit message เป็นภาษาไทย**: เมื่อ user สั่ง commit ให้เขียน commit message เป็นภาษาไทย (รูปแบบ Conventional Commits: `<type>(<scope>): <ใจความภาษาไทย>`)

---