# E2E Testing — Playwright ทดสอบ flow จริงผ่าน UI (login, task CRUD, dependency) บน Supabase local

## Business Goals

- มี gate อัตโนมัติที่ทดสอบ flow จริง end-to-end แทนข้อ `[manual]` ใน Phase 6 ของ `sub-plan-task-dependency-gantt.md`
- จับ integration bug UI ↔ Supabase (RLS, trigger, realtime) ที่ unit test จับไม่ได้
- มี smoke net ครอบคลุม flow ที่เพิ่งทำใน Phase 3–5 (TaskModal, dependency, Gantt)

---

## Phase 1: Tooling Setup

### Install & configure

- [x] `bun add -d @playwright/test` + `bunx playwright install chromium` — เดียว browser เดียวพอ
- [x] สร้าง `playwright.config.ts` — testDir `tests/e2e`, **พอร์ตเฉพาะ 5200** (`E2E_PORT`) กัน reuse dev server ของ user ที่ชี้ prod, projects: setup → e2e (storageState) + **vite cacheDir แยก** (`NUXT_VITE_CACHE_DIR` → `node_modules/.vite-e2e`, เพิ่ม 1 บรรทัดใน nuxt.config) — สอง dev server แชร์ cache เดิมแล้ว 504 Outdated Optimize Dep
- [x] config อ่าน keys จาก `supabase status -o json` (local เท่านั้น, มี env override `E2E_SUPABASE_*` ครอบไว้เผื่อย้ายไป remote dev project ในอนาคต) — **ยืนยันจากรounds นี้**: รันกับ `supabase start` (Docker) ก่อน เพราะ env เดิมมีแค่ prod
- [x] เพิ่ม script `"test:e2e": "playwright test"` ใน `package.json` — แยกจาก `test` (unit)
- [x] เพิ่ม `test-results/`, `playwright-report/`, `tests/e2e/.auth/` ใน `.gitignore`

### Auth & data fixtures (จุดยากสุดของ E2E)

- [x] `tests/e2e/setup.spec.ts` — admin API (service key, `email_confirm: true`) สร้าง user ถาวร `e2e@helm.local`, password grant ก่อน/create ทีหลัง — **gotrue admin API ไม่เก็บ `data` ลง raw_user_meta_data** → trigger สร้าง workspace ชื่อ default "My Workspace" จึง lookup ด้วย workspace ตัวแรกของ user (RLS จำกัดแล้ว) แทน filter ชื่อ
- [x] เก็บ session ด้วยการ login ผ่าน UI 1 ครั้ง → `storageState` (`tests/e2e/.auth/user.json`) + บันทึกระบาย workspace/project id ที่ `.auth/context.json` ให้ specs อื่นใช้
- [x] นโยบายข้อมูล: ชื่อ prefix `E2E ` + ลบทิ้งท้ายเทสต์ (crud ลบผ่าน UI, dep spec ลบผ่าน API ใน afterAll) — ไม่ wipe DB

## Phase 2: First flows (vertical slice — flow ละไฟล์)

### Auth (`tests/e2e/auth.spec.ts`)

- [x] login ถูกต้อง (email+password ผ่าน UI form จริง) → เข้า app ได้, URL หลุดจาก /login
- [x] login ผิด → ขึ้นข้อความ error, อยู่ /login

### Task CRUD (`tests/e2e/task-crud.spec.ts`)

- [x] สร้าง task ผ่าน TaskModal (title/status/phase) → เห็นบน Kanban
- [x] แก้ task title → persist หลัง reload (status/phase ไม่ assert ใน e2e — unit/trigger ครอบคลุมแล้ว เลี่ยง selector บวม)
- [x] ลบ task → หายจาก Kanban

### Dependency (`tests/e2e/dependency.spec.ts`)

- [x] เพิ่ม dependency A→B ผ่าน UI → badge blocked ปรากฏบน B
- [x] พยายามสร้าง cycle B→A → UI ขึ้น error และไม่บันทึก

## Phase 3: Gate & Close

- [x] `bun run test:e2e` เขียวทั้ง suite (headless, webServer auto-start)
- [x] `bun run test` + `bun run typecheck` ยังเขียว (unit ไม่โดน e2e ไฟล์)
- [x] อัปเดต Phase 6 ของ `sub-plan-task-dependency-gantt.md` — ข้อที่มี E2E แตะแล้ว mark เป็น [auto]
- [x] จดข้อจำกัด/ข้อมูลคงค้างในไฟล์นี้

---

## Deferred (YAGNI)

| งาน | ทำเมื่อ |
| --- | --- |
| รัน E2E กับ remote dev project (env override `E2E_SUPABASE_*` มีไว้แล้ว) | เมื่อมี project dev แยกจาก prod จริง |
| Mobile viewport matrix / responsive | เมื่อมี bug จริง |
| CI รัน E2E อัตโนมัติ | เมื่อมี pipeline |
| Visual assertion ของ Gantt arrows เป๊ะๆ | เริ่มจาก smoke ว่า render แล้วค่อย refine |
| Signup flow test เต็มๆ | local autoconfirm ต่างจาก prod — จะ testing เฉพาะเมื่อ logic signup มี bug |

---

## Appendix: ไฟล์ที่กระทบ

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `package.json` | +@playwright/test (devDep), +`test:e2e` script |
| `playwright.config.ts` | ใหม่ — webServer + local supabase env + projects |
| `tests/e2e/setup.spec.ts` | ใหม่ — user/session/project bootstrap |
| `tests/e2e/auth.spec.ts` | ใหม่ |
| `tests/e2e/task-crud.spec.ts` | ใหม่ |
| `tests/e2e/dependency.spec.ts` | ใหม่ |
| `tests/e2e/helpers.ts` | ใหม่ — supabase local keys, REST helpers, cleanup |
| `app/...` (เฉพาะที่จำเป็น) | `data-testid` เพิ่มในจุดที่ selector มั่นคงไม่ได้ (ปุ่ม new task, TaskModal fields) — ไม่มี behavioral change |
| `.gitignore` | +`test-results/`, `playwright-report/`, `tests/e2e/.auth/` |

## Implementation Notes (ณ implement จบ)

- รัน: `supabase start` (local) แล้ว `bun run test:e2e` — webServer auto-start port 5200, อ่าน keys จาก `supabase status` (override ด้วย `E2E_SUPABASE_*` ได้สำหรับ remote dev ในอนาคต)
- selectors: เพิ่ม `data-testid` ใน TaskCard/TaskModal/board/ConfirmDialog (add-task, task-title, task-save, task-delete, dep-select, dep-error, task-card, task-card-title, blocked-badge, confirm-ok) — ไม่มี behavioral change
- `loginViaUI()` มี retry — vite cold dep-optimizer (dev-only) ทำ full-reload ล้างฟอร์มระหว่าง submit ได้
- ข้อมูลคงค้างใน local DB: user `e2e@helm.local` + workspace/project ชื่อ `E2E Project` (ถาวร, reuse ทุก run) — task ที่เทสต์สร้างถูกลบหมดแล้ว
- ผล: e2e 8/8 (~35–45s), unit 20/20, typecheck เขียว
