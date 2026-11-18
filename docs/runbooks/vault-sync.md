# Runbook: Vault sync

ตัวซิงก์ Task ระหว่าง Obsidian vault กับ Helm (`tools/vault-sync/`) ดูกติกาเจ้าของฟิลด์ที่ `docs/adr/0003-vault-sync-field-ownership.md`

รันมือครั้งเดียวต่อรอบ (ไม่มี poller/Docker): ตอน "ปล่อยงาน" และก่อนเปิด dotpm ดูภาพรวม

## กฎสำคัญ: รันทีละเครื่อง

Vault กระจายด้วย Syncthing ถ้ามีตัวซิงก์สองตัวแก้ไฟล์เดียวกันจะเกิด `*.sync-conflict-*` เพิ่ม (lock กันได้เฉพาะในเครื่องเดียวกัน)

## ติดตั้ง

1. `cd tools/vault-sync && bun install && cp .env.example .env` แล้วกรอก `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (ห้าม commit), `WORKSPACE_ID`, `VAULT_DIR` (โฟลเดอร์ที่มี `ลูกค้า/` อยู่ข้างใน)
2. `cp aliases.example.json aliases.json` แล้วแก้: `customers` = ชื่อโฟลเดอร์ลูกค้า → ชื่อ Customer ใน Helm, `features` = ค่า `module` → ชื่อ Feature ใน Helm (ไม่ตั้ง alias = ใช้ชื่อตรง ๆ) ถ้าไม่พบ ตัวซิงก์จะ warning และไม่สร้างใหม่

สถานะ lock และ `known-keys.json` อยู่ใน `tools/vault-sync/.state/` (ตั้ง `STATE_DIR` เปลี่ยนได้)

## ลำดับรันครั้งแรก

1. `bun run dry-run` ดูรายการที่จะเปลี่ยน ไม่เขียนอะไรเลย ตรวจ warning/error (ลูกค้า/Feature ที่จับคู่ไม่เจอ, id ซ้ำ)
2. `bun src/cli.ts --seed` รอบเดียว: Task ใหม่ใน Helm รับ status/due/assignee จากไฟล์ (ไม่ใช่ `todo`) และไฟล์เหล่านั้นไม่ถูกเขียนกลับในรอบนี้ (ลอง `--seed --dry-run` ก่อนได้)
3. หลังจากนั้นใช้ `bun run sync` (Helm เป็นเจ้าของ status/assignee/due จะเขียนทับค่าที่แก้ใน dotpm)

อย่าใช้ `--seed` ซ้ำหลังเริ่มใช้งานจริง — Task ใหม่จะรับสถานะจากไฟล์แทน `todo`

## อ่านผลรัน

- ดู output ในเทอร์มินัล (บรรทัด `WARN`, `ERROR`)
- ใน vault: `ลูกค้า/Helm Tasks.md` (ตารางสถานะ + คอลัมน์เตือนเลยกำหนด)
- ไฟล์ถูกแก้ภายใน 30 วินาทีจะถูกเลื่อนไปรอบหน้า (warning ปกติ) · id ซ้ำ = ข้ามทั้งสองไฟล์ · ถ้าไม่พบไฟล์ Task เลย ตัวซิงก์จะไม่ cancel อะไร (ตรวจ `VAULT_DIR`)

### Lock ค้าง

ถ้าถูก kill แรง ๆ แล้วขึ้น "มี vault-sync รันอยู่แล้ว (pid …)" ทั้งที่ไม่มีตัวอื่นรัน ให้ยืนยันก่อนว่าไม่มี instance อื่น (รวมเครื่องอื่น) แล้วลบ `tools/vault-sync/.state/lock`
