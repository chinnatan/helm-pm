# Helm PM

เครื่องมือบริหารงานของทีมพัฒนา Vinai QMS เพื่อให้เห็นภาพรวมว่า ทำงานอะไรอยู่ ลูกค้าไหน ฟีเจอร์อะไร และ timeline เป็นอย่างไร

## Language

**Feature**:
ความสามารถของ Vinai QMS (product เดียวของระบบนี้) ที่ใช้ร่วมกันทุกลูกค้า สร้างเองได้ในหน้า settings เช่น Change Control, CAPA, Inspection Management
_Avoid_: Module, Project

**Customer**:
องค์กรที่ใช้ Vinai QMS (เช่น SJC, TNT, Siam Aisin)
_Avoid_: Client

**Rollout**:
จุดตัดของ Customer หนึ่งราย กับ Feature หนึ่งอย่าง เป็นหน่วยที่ตอบว่า "Change Control ของ SJC อยู่สถานะไหน"
_Avoid_: Delivery

**Rollout status**:
สถานะ "ปัจจุบัน" ของ Rollout ที่ผู้ใช้ตั้งเอง (ไม่คำนวณจาก Task และไม่เปลี่ยนอัตโนมัติเมื่อถึงเดือนที่สัญญา): planned → developing → testing → production หรือ cancelled

**Commitment**:
คำสัญญาต่อลูกค้าว่า Rollout ใดจะอยู่สถานะใดในเดือนใด (หน่วยหยาบระดับเดือน) แยกจากแผนวันที่ภายในของ Task 1 Commitment = 1 Rollout ต่อ 1 เดือน ข้อย่อยคือ Task การเลื่อนเดือนเก็บประวัติ (เดือนเดิม → ใหม่ พร้อมเหตุผล) Commitment แทน Milestone เดิมทั้งหมด

**Target status**:
สถานะที่ Commitment สัญญาไว้สำหรับเดือนนั้น (developing, testing หรือ production) ต่างจาก Rollout status ที่เป็นสถานะปัจจุบัน Rollout หนึ่งมีหลาย Commitment ได้ และ Target status ควรไล่ขึ้นตามเดือน (ไม่ถอยหลัง) Rollout ที่ cancelled ไม่ถือว่ามีสถานะที่สัญญาไว้อีกต่อไป

**Inbox**:
Task ที่ได้จาก Quick capture และยังไม่ถูกผูก Customer/Feature ใช้จัดโครงทีหลัง Quick capture รับแท็ก inline เช่น `#SJC #change_control` เพื่อผูกอัตโนมัติ

**Task**:
งานหนึ่งชิ้นที่มีผู้รับผิดชอบ และผูกกับ Customer/Feature ตาม Task scope มี Task type เป็น feature, bug, infra หรือ customer-request
_Avoid_: Issue, Request, Epic (เป็นเพียง Task type ไม่ใช่ entity แยก)

**Task status**:
inbox → todo → in_progress → testing → done หรือ cancelled (การ "ปล่อยใช้งาน" อยู่ที่ Rollout status ไม่ใช่ Task)

**Task type**:
ประเภทของ Task: feature, bug, infra, customer-request

**Task scope**:
Task ผูกกับ Customer และ/หรือ Feature ได้ไม่บังคับครบ: มีทั้งคู่ = Rollout, มีแต่ Feature = product-wide, มีแต่ Customer = งานของลูกค้านั้น, ไม่มี = งานภายใน (หน้ารวมต้องแสดง "ยังไม่ผูก")

**Customer response**:
คำตอบของทีมต่อ Task type customer-request: accepted, deferred หรือ rejected พร้อมข้อความตอบ (ว่าง = ยังไม่ตอบ) แต่ละคำขอมีสวิตช์ "แสดงให้ลูกค้าเห็น" และวันที่รับคำขอ

**Issue Log**:
เอกสารรวมคำขอลูกค้าพร้อมคำตอบ ในช่วงวันที่รับคำขอหนึ่ง ๆ สร้างจาก Task ไม่ใช่ข้อมูลแยก มีฉบับลูกค้า (ตัดรายการภายในออก) และฉบับภายใน

**Share link**:
ลิงก์แบบอ่านอย่างเดียวของลูกค้าหนึ่งราย (ไม่ต้อง login มีวันหมดอายุ เพิกถอนได้) แสดงแผนการส่งมอบรายเดือนและคำขอ/คำตอบที่เปิดให้ลูกค้าเห็นเท่านั้น

**Team focus**:
ลำดับงานปัจจุบัน (1–3 ชิ้น) ของแต่ละคน เรียงได้ ใช้ตอบว่า "ตอนนี้ใครทำอะไร"

**Quick capture**:
การจดข้อความสั้น ๆ เพื่อแปลงเป็น Task ภายหลัง โดยไม่ต้องกรอกฟอร์มเต็ม

**Member**:
ผู้ใช้ที่อยู่ใน Workspace หนึ่ง มี permission role (admin, manager, member, viewer) และ job role แยกกัน
_Avoid_: User (กำกวมกับบัญชีผู้ใช้)

**Remove**:
การนำ Member ออกจากทีม (Workspace) โดย admin เท่านั้น ไม่ใช่การลบบัญชีผู้ใช้ งานที่เขารับผิดชอบต้องโอนหรือปล่อยว่างก่อน ห้ามนำ admin คนสุดท้ายออก
_Avoid_: Delete user, Kick

**Leave**:
การที่ Member ออกจากทีมด้วยตัวเอง ใช้กฎเดียวกับ Remove

**Former member**:
คนที่เคยเป็น Member แล้วถูก Remove หรือ Leave ประวัติเดิม (คอมเมนต์ กิจกรรมของ Task) แสดงเป็น "อดีตสมาชิก"

**Vault**:
โฟลเดอร์ Obsidian `my-work` ที่ทีมใช้เขียนเอกสารวางแผนงานลูกค้า (Plan, Task, Use Case) เป็นที่นิยามงาน ส่วน Helm เป็นที่ติดตามความเคลื่อนไหวของงาน

**External key**:
รหัสงานที่มาจาก Vault (เช่น `T-CC-01`) เก็บแยกจากชื่อ Task ใน Helm และไม่ซ้ำกันในหนึ่ง Workspace ใช้เป็นกุญแจจับคู่ Task ของ Helm กับไฟล์ Task ใน Vault Task ที่ไม่มี External key คือ Task ที่ไม่ได้มาจาก Vault

**Vault sync**:
การซิงก์ Task ระหว่าง Vault กับ Helm โดยแบ่งเจ้าของตามฟิลด์: Vault เป็นเจ้าของ "นิยามงาน" (รหัส, ชื่อ, ลำดับก่อน-หลัง) Helm เป็นเจ้าของ "ความเคลื่อนไหว" (Task status, ผู้รับผิดชอบ, กำหนดเสร็จ) ครอบคลุมเฉพาะ Task ไม่รวม Requirement, Use Case และ Plan
_Avoid_: Import, Export (ซิงก์สองทิศ)
