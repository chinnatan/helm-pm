# Vault Sync — ซิงก์ Task ระหว่าง Helm กับ Obsidian vault (dotpm)

## Business Goals

- เขียนนิยามงาน (Task/Use Case) ใน Obsidian แล้ว Task ไปอยู่ใน Helm โดยไม่ต้องคีย์ซ้ำ
- สถานะ ผู้รับผิดชอบ กำหนดเสร็จ ที่ทีมอัปเดตใน Helm ปรากฏกลับในไฟล์ Task และ dotpm อัตโนมัติ
- ไม่ทำให้ไฟล์ใน vault เสีย (wikilink, ชื่อไฟล์, เนื้อหา) และไม่เกิด Syncthing conflict เพิ่ม
- รอบแรกครอบคลุมเฉพาะ Task ไม่รวม Requirement, Use Case, Plan

ตัดสินใจแล้ว: ดู `CONTEXT.md` (Vault / External key / Vault sync) และ `docs/adr/0003-vault-sync-field-ownership.md`

กติกาสรุป: Vault เป็นเจ้าของ รหัส/ชื่อ/`depends_on` · Helm เป็นเจ้าของ status/assignee/due · เจ้าของฟิลด์ชนะ ไม่ merge

---

## Phase 1: Database (migration 036)

### External key

- [x] สร้าง `036_task_external_key.sql` เพิ่มคอลัมน์ `tasks.external_key text` (nullable) — `tasks.workspace_id` มีตรง ๆ; RLS/log_task_changes ไม่ต้องแก้; อัปเดต `app/types/index.ts` และ `database.ts` แล้ว
- [x] เพิ่ม unique index `(workspace_id, external_key)` เฉพาะแถวที่ไม่ null — ทดสอบบน DB local ใน transaction ที่ rollback: key ซ้ำถูกปฏิเสธ, NULL หลายแถวผ่าน, key เดียวกันคนละ workspace ผ่าน
- [x] แสดง External key ใน UI Task (badge อ่านอย่างเดียวในหน้า Task panel) เพื่อให้เห็นว่า Task มาจาก Vault — `UBadge` ใน `TaskModal.vue` (โหมดแก้ไขเท่านั้น, เมื่อมีค่า) + i18n `tasks.externalKeyHint`

### ตรวจ dependency เดิม

- [x] ยืนยันว่าตาราง dependency ของ Task (จาก `sub-plan-task-dependency-gantt`) รองรับสร้าง/ลบจากภายนอก และ sync ใช้ได้โดยไม่ผิด constraint (กันวนลูป) — ผ่าน: `task_dependencies(task_id, depends_on_task_id)` UNIQUE + CHECK ห้ามพึ่งตัวเอง + trigger `check_circular_dependency` (migration 029, transitive) กันวนที่ระดับ DB; service key bypass RLS แต่ trigger/constraint ยังทำงาน. ข้อสังเกต: ไม่มี DB check ว่าสอง Task อยู่ workspace เดียวกัน → CLI ต้องกรอง workspace เอง

---

## Phase 2: Vault sync CLI (bun)

### โครงและค่าตั้ง

- [x] สร้าง `tools/vault-sync/` (bun + TypeScript) แยกจาก app และ worker เดิม — src/{frontmatter,status,sync,store,cli}.ts; ยังไม่ได้ `bun install` ใน tools/vault-sync
- [x] อ่านค่าจาก env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WORKSPACE_ID`, `VAULT_DIR`, `POLL_INTERVAL_SEC` — cli.ts (+ STATE_DIR, ALIAS_FILE เป็นทางเลือก)
- [x] อ่านไฟล์ config alias (ชื่อโฟลเดอร์ลูกค้า → Customer, `module` → Feature) — aliases.json (ดู aliases.example.json)

### อ่านไฟล์ Task จาก vault

- [x] สแกน `ลูกค้า/**/_tasks/*.md` ที่มี `pm-task: true` (ข้าม `*.sync-conflict-*`) — ทดสอบแล้ว (unit)
- [x] parse frontmatter: `id`, `title`, `module`, `depends_on`, `status`, `due`, `assignee` — ทดสอบแล้ว; ไม่มีไฟล์ `assignee` ใน vault จริง (dotpm ใช้ `assignees`) จึงเขียนคีย์ `assignee` เพิ่ม
- [x] ตรวจรหัส `id` ซ้ำข้ามไฟล์ → หยุดทั้งสองไฟล์และบันทึก error — ทดสอบแล้ว

### Vault → Helm (นิยามงาน)

- [x] upsert Task ตาม `external_key = id` เฉพาะชื่อ, Customer, Feature (สร้างใหม่ = `todo`) — ทดสอบด้วย fake store
- [x] จับคู่ Customer จากชื่อโฟลเดอร์ และ Feature จาก `module` ตาม alias; ถ้าไม่เจอผูกเท่าที่เจอและ warning (ไม่สร้างใหม่) — ทดสอบด้วย fake store
- [x] ซิงก์ `depends_on` เป็น dependency ของ Helm — ทดสอบด้วย fake store; ตรวจ trigger วนลูป (23514) บน DB local ใน transaction ที่ rollback
- [x] ไฟล์ที่หายจาก vault → ตั้ง Task ใน Helm เป็น `cancelled` และบันทึก log (ไม่ลบแถว) — ทดสอบ + กัน vault ว่างไม่ให้ cancel ยกชุด

### Helm → Vault (ความเคลื่อนไหว)

- [x] ดึง Task ที่มี `external_key` ในรอบ poll — store.tasks() กรอง workspace + external_key not null
- [x] แมปสถานะ: todo↔todo, in_progress↔in-progress, testing↔review, done↔done, cancelled↔superseded (`inbox` ไม่เขียนลง vault) — ทดสอบแล้ว
- [x] แก้เฉพาะบรรทัด frontmatter ของ `status`, `due`, `assignee` (assignee = ชื่อที่แสดงของ Member) ไม่แตะเนื้อหาและไม่เปลี่ยนชื่อไฟล์ — ทดสอบ byte-for-byte รวม CRLF/ไทย/คอมเมนต์
- [x] ข้ามไฟล์ที่ถูกแก้ภายใน 30 วินาที แล้วลองรอบถัดไป — ทดสอบแล้ว
- [x] Task ที่ Helm ลบ → ตั้ง `status: superseded` ในไฟล์ (ไม่ลบไฟล์) — ต้องมี state file known-keys.json (STATE_DIR) เพื่อแยก 'Helm ลบ' กับ 'ใหม่ใน vault'

### ไฟล์ generated

- [x] สร้าง `ลูกค้า/Helm Tasks.md` จากข้อมูล Helm (รูปแบบเดิม: ตารางสถานะ กำหนดเสร็จ สถานะเตือน) — ทดสอบ format/emoji; เขียนเมื่อเนื้อหาเปลี่ยนเท่านั้น (ไม่นับบรรทัด synced)
- [x] สร้าง `ลูกค้า/Helm Sync Log.md` (เวลา, จำนวน push/pull, warning/error รอบล่าสุด) — ทดสอบแล้ว

### โหมด seed (รันครั้งแรก)

- [x] `--seed`: Task ใหม่ใช้ status (แมปจากไฟล์) / due / assignee (จับคู่ด้วยชื่อที่แสดง) จากไฟล์ และไม่เขียนกลับไฟล์นั้นในรอบเดียวกัน; implies รอบเดียว; ใช้กับ `--dry-run` ได้ — ทดสอบ 3 เคส (seed คง done, ไม่ seed = todo แล้วรอบถัดไป pull, dry-run ไม่เขียน)

### ความปลอดภัยของการรัน

- [x] ใช้ lock กันรันซ้อนในเครื่องเดียว และโหมด `--dry-run` พิมพ์สิ่งที่จะเปลี่ยนโดยไม่เขียนจริง — lock ใน STATE_DIR (ไม่ได้ทดสอบอัตโนมัติ); dry-run ทดสอบแล้วว่าไม่เขียนอะไร
- [x] ให้สิทธิ์ service key ใช้เฉพาะ `WORKSPACE_ID` ที่ตั้ง (โค้ดกรองทุก query) — ทุก query ใน store.ts กรอง workspace_id (deps กรองผ่าน task id ของ workspace); ไม่ได้ทดสอบกับ Supabase จริง

---

## Phase 3: Docker

- [x] เขียน `tools/vault-sync/Dockerfile` (bun slim, รันด้วย user ที่ไม่ใช่ root) — `docker build` ผ่าน (context = repo root, มี `bun.lock` และ `Dockerfile.dockerignore` ของตัวเอง); smoke `--once --dry-run` กับ fixture vault + `--network none` ขึ้นได้และ resolve supabase-js ได้ (ล้มที่ network ตามคาด); ไม่ได้ทดสอบกับ Supabase จริง
- [x] เขียน `tools/vault-sync/compose.yml`: mount เฉพาะ `ลูกค้า/` แบบ read-write, `restart: unless-stopped`, `env_file: .env` — เขียนแล้ว แต่ยังไม่ได้รัน `docker compose up` (ทดสอบเฉพาะ `docker run` ด้วย flag เทียบเท่า)
- [x] เพิ่ม `.env.example` และใส่ `.env` ใน `.gitignore` — `tools/vault-sync/.gitignore`
- [x] เขียน `docs/runbooks/vault-sync.md` (ติดตั้ง, ตั้ง user/uid ให้ตรงเจ้าของไฟล์, รันเครื่องเดียว, ตรวจ log, หยุดเมื่อมีปัญหา)

---

## Phase 4: ปรับ Vault (งานนอก repo นี้ — ขออนุญาตก่อนแก้)

- [x] แก้ข้อ 4, 7, 8 ของ skill `plan-customer`: `status`/`due`/`assignee` ซิงก์จาก Helm ห้ามแก้มือ, ตัด `blocked` ออกจาก enum, `id` ห้ามเปลี่ยนหลังซิงก์ (แก้แล้ว ยังไม่ commit ใน vault)
- [x] เพิ่ม `assignee: ""` และ `due: ""` ใน template `task.md` (ใช้ชื่อฟิลด์ `assignee` ตามที่ CLI เขียน ไม่ใช่ `assignees`)
- [x] ตรวจ Task ทุกไฟล์ใน `_tasks/` (ไม่รวม conflict copy): ทุกไฟล์มี `id` และ `pm-task: true`, ไม่มี `id` ซ้ำ · สถานะที่พบ: todo 25, done 28, review 10, in-progress 6, blocked 3, superseded 3, cancelled 1 → `blocked` (3) และ `cancelled` (1) จะกลายเป็น `todo` ตอน `--seed` (ไม่ได้แก้ไฟล์เก่า รอผู้ใช้ตัดสินใจก่อน seed)
- [x] อัปเดต `ลูกค้า/GLOSSARY.md`: ปรับนิยาม Helm และเพิ่ม vault-sync

---

## Phase 5: Review & Quality Assurance

- [x] unit test (vitest): parse/แก้ frontmatter, แมปสถานะ, ตรวจรหัสซ้ำ, ข้ามไฟล์ที่เพิ่งแก้ (ทำใน Phase 2 · เพิ่มกรณีไฟล์ชื่อ slug ตัวเล็กหลัง dry-run เจอบั๊ก)
- [x] integration test บนโฟลเดอร์ vault จำลอง: push สร้าง Task, pull เขียนสถานะ, ไฟล์หาย → cancelled, `depends_on` → dependency (ใช้ store ปลอม — `store.ts` กับ Supabase จริงยังไม่มี test อัตโนมัติ ทดสอบ delete-and-reinsert/cycle ด้วยมือใน DB local แล้ว)
- [x] ทดลอง `--dry-run --seed` กับ vault จริง (อ่านอย่างเดียว) ต่อ DB local ที่ apply 036 แล้ว: **เจอบั๊ก scanner ข้ามไฟล์ slug ตัวเล็กของ dotpm (ได้ 4/80)** แก้แล้ว → push 76 Task: done 28, testing 10, in_progress 6, todo 29, cancelled 3, ไม่มี ERROR, vault ไม่เปลี่ยน (git status เท่าเดิม) · WARN 123 เพราะ DB local ไม่มี Customer/Feature ตรงชื่อ → **ต้อง dry-run ซ้ำกับ Helm จริงเพื่อตั้ง `aliases.json`**
- [x] สถานะ T-EA-03/10/11/12: ไม่แก้ไฟล์ vault — ให้ `--seed` แมป `cancelled` (ค่า dotpm เก่า) → cancelled และ `blocked` → todo (มี test)
- [x] รัน typecheck และ test ทั้งชุดของ repo (75 tests ผ่าน, typecheck ผ่าน; lint ไม่มี eslint config)
- [x] อัปเดต checklist นี้เป็น `[x]` พร้อมหมายเหตุผลลัพธ์

---

## Appendix: ผล research

| เรื่อง | ข้อเท็จจริง |
|---|---|
| ตัวซิงก์เดิม | ไม่พบสคริปต์/scheduler ที่สร้าง `Helm Tasks.md` ใน repo หรือเครื่องนี้ |
| dotpm | อ่าน `pm-project` / `pm-task` จาก frontmatter · ถ้าแก้ผ่าน dotpm จะเขียน frontmatter ใหม่และเปลี่ยนชื่อไฟล์เป็น slug |
| Syncthing | vault มีไฟล์ `*.sync-conflict-*` จำนวนมาก → ต้องรัน sync เครื่องเดียว |
| Docker Desktop (macOS) | ไม่ส่ง fsevents เข้า bind mount → ใช้ poll |
| Helm priority | มี low/medium/high/urgent อยู่แล้ว · รอ scale ใหม่ (Critical/High) ค่อยแมป — ไม่อยู่ใน plan นี้ |
| ไฟล์ที่กระทบ | `supabase/migrations/036_*`, `tools/vault-sync/*` (ใหม่), `app/components/tasks/*` (badge), `docs/runbooks/vault-sync.md`, `CONTEXT.md`, `docs/adr/0003-*` (เขียนแล้ว) |
