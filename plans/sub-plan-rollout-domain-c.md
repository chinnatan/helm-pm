# Rollout Domain (ก้อน C) — Customer response, Issue Log export และลิงก์แชร์ให้ลูกค้า

## Business Goals

- ตอบคำขอ/ข้อสังเกตของลูกค้าแล้วเก็บคำตอบไว้กับงานเดียวกัน ไม่ต้องจด Issue Log แยกใน Obsidian
- ออกเอกสาร "Issue Log For Customer" ได้ในคลิกเดียว (แยกรายการภายในออกจากรายการที่ลูกค้าเห็น)
- ให้ลูกค้าดู Timeline และคำตอบของตัวเองผ่านลิงก์ได้เอง โดยไม่ต้อง login และไม่เห็นข้อมูลภายใน

---

## Phase 1: Customer response (ข้อมูล + ฟอร์ม)

### Data (migration 033)
- [x] เพิ่มคอลัมน์ใน `tasks`: `response_status` (accepted / deferred / rejected, null = ยังไม่ตอบ), `response_text`, `customer_visible` (boolean default true), `requested_on` (date default วันนี้) — migration 033
- [x] เพิ่ม CHECK ให้ `response_status` ใช้ได้เฉพาะ `task_type = 'customer-request'` — ครอบ `response_text` ด้วย; ฟอร์มล้างคำตอบเมื่อเปลี่ยนประเภทออกจาก customer-request
- [x] อัปเดต `database.ts`, `Task` type และ `log_task_changes` ให้บันทึก `response_status` ใน activity log

### UI
- [x] เพิ่มส่วน "คำตอบลูกค้า" ใน `TaskModal` เมื่อประเภทงานเป็น customer-request: สถานะคำตอบ, ข้อความตอบ, สวิตช์ "แสดงให้ลูกค้าเห็น", วันที่รับคำขอ
- [x] แสดงป้ายสถานะคำตอบบน `TaskCard` และคอลัมน์ในหน้า list (ว่าง = ยังไม่ตอบ)
- [x] เพิ่มตัวกรอง "ยังไม่ตอบ" ในแถบกรอง — `?unanswered=1`
- [x] เพิ่ม i18n ไทย/อังกฤษ

## Phase 2: Issue Log export

### Logic (ฟังก์ชันล้วน ทดสอบด้วย unit test)
- [x] เพิ่ม `buildIssueLogMarkdown(requests, { forCustomer, intro })` ใน `app/utils/issueLog.ts` — รูปแบบเดียวกับโน้ตเดิม (`Q: #feature ข้อความ` / `A: คำตอบ` คั่นด้วย `---`, intro ไว้บนสุด)
- [x] เมื่อ `forCustomer` ตัดรายการ `customer_visible = false` ออก ส่วนฉบับภายในแสดงทุกรายการ
- [x] เขียน `tests/unit/issueLog.test.ts` ครอบ: ฉบับลูกค้าซ่อนรายการภายใน, ยังไม่ตอบ (A ว่าง), tag ฟีเจอร์แปลงเป็น `#ชื่อ_แบบ_ขีดล่าง`, ไม่มีฟีเจอร์, intro ว่าง, เรียงตามวันที่รับ — 8 เคส

### UI
- [x] สร้างหน้า `/customers/[id]/issue-log` — เลือกช่วงวันที่รับคำขอ, สลับ "ฉบับลูกค้า / ฉบับภายใน", ช่องข้อความ intro, พรีวิวรายการ — ย้าย `customers/[id].vue` เป็น `customers/[id]/index.vue` เพื่อให้มี child route
- [x] ปุ่ม "คัดลอก Markdown" และ "พิมพ์/บันทึก PDF" (print stylesheet ของเบราว์เซอร์ ไม่สร้าง PDF ฝั่งเซิร์ฟเวอร์) — เพิ่ม `print:hidden` ที่ layout เพื่อพิมพ์เฉพาะเนื้อหา
- [x] เพิ่มลิงก์เข้าหน้านี้จาก `customers/[id]`

## Phase 3: ลิงก์แชร์แบบอ่านอย่างเดียว

### Data (migration 034)
- [x] สร้างตาราง `customer_share_links` (workspace_id, customer_id, token สุ่มยาว, expires_at, revoked_at, created_by) พร้อม RLS ให้ admin/manager จัดการได้ — migration 034; ถอนสิทธิ์ anon บนตารางเพิ่มจาก default ของ Supabase
- [x] สร้าง RPC `get_customer_share(p_token)` แบบ SECURITY DEFINER (รูปแบบเดียวกับ `get_invite_preview`) คืน JSON: ชื่อลูกค้า, Rollout + สถานะ + เดือน Commitment, และเฉพาะคำขอที่ `customer_visible = true` (ข้อความคำขอ, สถานะ/ข้อความตอบ, วันที่) — ไม่คืนข้อมูลภายในอื่นใด
- [x] ให้ `anon` เรียก RPC ได้เท่านั้น (ไม่มีสิทธิ์อ่านตารางตรง) และคืน `not_found` เมื่อ token ผิด/หมดอายุ/ถูกเพิกถอน
- [x] ทดสอบสิทธิ์ด้วย SQL: anon เรียกด้วย token ถูก/ผิด/หมดอายุ/เพิกถอน และอ่านตารางตรงไม่ได้ — admin เห็นลิงก์ได้, member/anon เห็น 0 แถวและสร้างไม่ได้, token ผิด/หมดอายุ/เพิกถอน → `not_found`, RPC ไม่คืนรายการภายในหรืองานประเภทอื่น

### UI
- [x] สร้างหน้า `/share/[token]` (ไม่ผ่าน auth middleware, layout เรียบง่าย) แสดง Timeline รายเดือนของลูกค้าและรายการคำขอพร้อมคำตอบ — layout `public` + `groupShareTimeline` (unit test 3 เคส)
- [x] เพิ่มส่วน "ลิงก์แชร์" ใน `customers/[id]`: สร้างลิงก์ (กำหนดวันหมดอายุ ค่าเริ่มต้น 30 วัน), คัดลอก, เพิกถอน, รายการลิงก์ที่ใช้อยู่
- [x] เพิ่ม i18n ไทย/อังกฤษ

## Phase 4: Review & Quality Assurance

- [x] เพิ่ม e2e: ตอบคำขอแล้วเห็นใน Issue Log, ฉบับลูกค้าไม่มีรายการภายใน, สร้างลิงก์แล้วเปิดโดยไม่ login เห็น Timeline/คำตอบ, เพิกถอนแล้วเปิดไม่ได้ — `customer-response.spec.ts` 4 เคส
- [x] รัน `nuxt typecheck`, vitest และ playwright บน Supabase local — typecheck 0 errors, vitest 43, playwright 24 ผ่าน
- [x] อัปเดตหมายเหตุผลลัพธ์ในไฟล์นี้, `PLAN.md` และ `CONTEXT.md` (เพิ่มคำ Issue Log, Share link)

---

## Appendix: Research

**รูปแบบ Issue Log ใน Obsidian (`1.Customer/SJC/`)**
- ไฟล์ตั้งชื่อด้วยวันที่ (`Issue Log 06-10-2026`) เป็นชุด `Q: #feature_tag ข้อความ` / `A: คำตอบ` คั่นด้วย `---` มี 14 ข้อ (ฉบับภายใน) และ 13 ข้อ (ฉบับลูกค้า)
- ฉบับลูกค้าต่างจากฉบับภายใน 2 อย่าง: มี intro 3 บรรทัดด้านบน และไม่มีข้อที่เป็นบั๊กภายใน ("น่าจะบัค Inspection ตอน Reject …") → จึงต้องมีสวิตช์ `customer_visible`
- ข้อที่ยังไม่ตอบมี `A:` ว่าง (9 จาก 14 ข้อ) และบางคำตอบเป็นการถามกลับ ("เข้าใจถูกไหมครับ") ซึ่งอยู่ในข้อความตอบได้ ไม่ต้องมีสถานะเพิ่ม
- tag ที่ใช้: `#user_management`, `#Internal_audit`, `#supplier_management`, `#document_control`, `#inspection_management` — ตรงกับชื่อฟีเจอร์เมื่อเปลี่ยน `_` เป็นช่องว่าง (ตัวแยก tag ของ Quick capture ก้อน B ใช้กติกาเดียวกัน)

**ผลต่อโมเดล**
- เก็บคำตอบเป็นคอลัมน์บน `tasks` (ไม่สร้างตารางแยก) ตามที่ตกลงว่า Issue = Task type customer-request
- หน่วย "ชุด Issue Log" คือช่วงวันที่ `requested_on` ไม่ใช่ entity แยก

**ตัดสินใจเรื่องที่ยังรอยืนยัน**
- หน่วยของ Issue Log เป็นช่วงวันที่รับคำขอ (แนะนำ) หรือชุดที่ตั้งชื่อเอง
- ลิงก์แชร์แสดง Timeline + คำขอ/คำตอบ (แนะนำ) หรือ Timeline อย่างเดียว
- ส่งออกเป็น Markdown + พิมพ์ PDF จากเบราว์เซอร์ (แนะนำ) หรือสร้างไฟล์ PDF/DOCX ฝั่งเซิร์ฟเวอร์
- สถานะคำตอบมี 3 ค่า accepted / deferred / rejected (แนะนำ) หรือเพิ่ม "ขอข้อมูลเพิ่ม"

**นอกขอบเขตก้อน C**
- ลูกค้า login เพื่อโต้ตอบ/ตอบกลับในระบบ (แชร์แบบอ่านอย่างเดียวเท่านั้น)
- แจ้งเตือนลูกค้าทางอีเมลเมื่อมีคำตอบใหม่
- วางหลายบรรทัดแตกเป็นหลาย Task (ค้างจากก้อน B)
