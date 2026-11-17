# Runbook: Vault sync

ตัวซิงก์ Task ระหว่าง Obsidian vault กับ Helm (`tools/vault-sync/`) ดูกติกาเจ้าของฟิลด์ที่ `docs/adr/0003-vault-sync-field-ownership.md`

## กฎสำคัญ: รันได้เครื่องเดียว

Vault กระจายด้วย Syncthing ถ้ามีตัวซิงก์สองตัวแก้ไฟล์เดียวกันจะเกิด `*.sync-conflict-*` เพิ่ม ให้รัน container นี้ **เครื่องเดียวเท่านั้น** (lock กันได้เฉพาะในเครื่องเดียวกัน)

## ติดตั้ง

1. `cd tools/vault-sync && cp .env.example .env` แล้วกรอก `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service key ห้าม commit), `WORKSPACE_ID`, `VAULT_HOST_DIR` (โฟลเดอร์ที่มี `ลูกค้า/` อยู่ข้างใน)
2. `cp aliases.example.json aliases.json` แล้วแก้: `customers` = ชื่อโฟลเดอร์ลูกค้า → ชื่อ Customer ใน Helm, `features` = ค่า `module` → ชื่อ Feature ใน Helm (ไม่ตั้ง alias = ใช้ชื่อตรง ๆ) ถ้าไม่พบ ตัวซิงก์จะ warning และไม่สร้างใหม่
3. ตั้ง uid/gid ให้ตรงเจ้าของไฟล์ใน vault: `id -u` / `id -g` ใส่ `SYNC_UID` / `SYNC_GID` ใน `.env` (ถ้าไม่ตรง จะเขียนไฟล์ไม่ได้หรือเจ้าของไฟล์เปลี่ยน)
4. `docker compose build`

Mount เฉพาะ `ลูกค้า/` (read-write) สถานะ lock และ `known-keys.json` อยู่ใน named volume `vault-sync-state` (`/state`)

## ลำดับรันครั้งแรก

1. `docker compose run --rm vault-sync --dry-run` ดูรายการที่จะเปลี่ยน ไม่เขียนอะไรเลย ตรวจ warning/error (ลูกค้า/Feature ที่จับคู่ไม่เจอ, id ซ้ำ)
2. `docker compose run --rm vault-sync --seed --once` รอบเดียว: Task ใหม่ใน Helm รับ status/due/assignee จากไฟล์ (ไม่ใช่ `todo`) และไฟล์เหล่านั้นไม่ถูกเขียนกลับในรอบนี้ (ลอง `--seed --dry-run` ก่อนได้)
3. `docker compose up -d` เข้าโหมดปกติ วนทุก `POLL_INTERVAL_SEC` (Helm เป็นเจ้าของ status/assignee/due)

อย่าใช้ `--seed` ซ้ำหลังเริ่มใช้งานจริง — Task ใหม่จะรับสถานะจากไฟล์แทน `todo`

## อ่าน log

- `docker compose logs -f vault-sync` (บรรทัด `WARN`, `ERROR`)
- ใน vault: `ลูกค้า/Helm Sync Log.md` (รอบล่าสุด: เวลา, push/pull, warning/error) และ `ลูกค้า/Helm Tasks.md` (ตารางสถานะ)
- ไฟล์ถูกแก้ภายใน 30 วินาทีจะถูกเลื่อนไปรอบหน้า (warning ปกติ) · id ซ้ำ = ข้ามทั้งสองไฟล์ · ถ้าไม่พบไฟล์ Task เลย ตัวซิงก์จะไม่ cancel อะไร (ตรวจ mount)

## หยุด

`docker compose stop vault-sync` (หรือ `down`) — ปล่อย lock อัตโนมัติ

### Lock ค้าง

ถ้า container ถูก kill แรง ๆ แล้วขึ้น "มี vault-sync รันอยู่แล้ว (pid …)" ทั้งที่ไม่มีตัวอื่นรัน ให้ยืนยันก่อนว่าไม่มี instance อื่น (รวมเครื่องอื่น) แล้วลบ lock: `docker compose run --rm --entrypoint rm vault-sync /state/lock`
