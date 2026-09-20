# Automated Testing Setup — ตั้งฐาน vitest + unit test สำหรับ dependency/phase logic (รองรับ Phase 6 ของ main plan)

## Business Goals

- มี test gate ที่รันซ้ำได้สำหรับ logic ที่เสี่ยงพลาดที่สุด: circular dependency detection + blocked status
- ทำให้ Phase 6 ใน `sub-plan-task-dependency-gantt.md` มีส่วนที่ automate ได้จริง (`bun run test`) แทน manual ทั้งหมด
- ฐานไว้ให้ Phase 3–5 ที่กำลังจะมา เขียน test ต่อได้ทันที

---

## Phase 1: Tooling Setup

### Install & configure

- [x] `bun add -d vitest` — ตัวเดียวพอ (logic ที่จะทดสอบเป็น pure TS ยังไม่ต้องการ happy-dom / @vue/test-utils)
- [x] สร้าง `vitest.config.ts` — `environment: "node"`, alias `~` → `./app`, include `tests/**/*.test.ts`
- [x] เพิ่ม scripts ใน `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
- [x] เพิ่ม `tests/` + `vitest.config.ts` ใน `tsconfig` ที่ typecheck มองเห็น — **confirm แล้วไม่ต้องแก้**: `.nuxt/tsconfig.json` include `../**/*` + alias `~` → `app` ครอบคลุม `tests/` อยู่แล้ว, `nuxt typecheck` เขียว

### Extract pure logic ( precondition ของการทดสอบ )

- [x] ย้าย BFS cycle detection จาก `useCollaboration.ts` → `app/utils/dependencyGraph.ts` เป็น pure function `graphWouldCreateCycle(deps, taskId, dependsOnTaskId)` — **เปลี่ยนชื่อจาก `wouldCreateCycle`**: ชื่อนี้ถูก auto-import จาก `app/utils` เป็น global ชนกับ local binding ใน template ของ TaskModal (vue-tsc fail); composable API เดิมคงชื่อ `wouldCreateCycle` ทุกประการ
- [x] เพิ่ม pure function `graphBlockedBy(deps, taskById, taskId)` / `graphIsBlocked(...)` ในไฟล์เดียวกัน (ย้าย logic จาก `useDependencyGraph()`) — prefix `graph` ด้วยเหตุผล auto-import collision เดียวกัน (`blockedBy`/`isBlocked` ซ้ำกับ local ใน TaskCard/KanbanBoard)
- [x] แก้ `useDependencyGraph()` ให้ wrap refs แล้ว call utils — **พฤติกรรมเดิมทุกประการ, UI ไม่แตะ**

---

## Phase 2: Unit Tests

### Dependency graph (`tests/unit/dependencyGraph.test.ts`)

- [x] Self-dependency A→A ต้อง detect cycle — TC-DG-01
- [x] Direct cycle A↔B ต้อง detect — TC-DG-02
- [x] Transitive cycle A→B→C→A ต้อง detect (เคสนี้คือ pain point เดิมของระบบ) — TC-DG-03, TC-DG-04
- [x] DAG ปกติ + diamond (A→B, A→C, B→D, C→D) ต้องไม่ false positive — TC-DG-05, TC-DG-06, TC-DG-07
- [x] `blockedBy`: dep ที่ closed (done/released/cancelled) ไม่ block, dep เปิดอยู่ block + คืนถูกงาน — TC-BL-01…08

### Phase helpers (`tests/unit/phase.test.ts`)

- [x] `TASK_PHASE_ORDER` ลำดับตรงกันกับ CHECK constraint ใน migration `029` — TC-PH-01, TC-PH-02
- [x] `taskPhaseMeta()` คืน meta ครบทุก `TASK_PHASE_VALUES` และ `undefined` เมื่อ phase = null — TC-PH-03, TC-PH-04

### Gate & Report

- [x] `bun run test` เขียว + `bun run typecheck` เขียว
- [x] เพิ่ม script `"test:report": "vitest run --reporter=junit --outputFile=reports/junit.xml"` — รายงานผลกลาง (JUnit XML) เปิดได้ด้วย CI/IDE ทุกตัว โดยไม่ต้องเพิ่ม dependency
- [x] เพิ่ม `reports/` ใน `.gitignore`
- [ ] (optional — เฉพาะเมื่อต้องส่ง report ให้ non-dev ดู) `bun add -d @vitest/ui` แล้ว `"test:ui": "vitest --ui"` — เลื่อนไว้ก่อน ยังไม่มีผู้รับ report
- [ ] (optional — เฉพาะเมื่อ coverage มีคนใช้จริง) `@vitest/coverage-v8` + `vitest run --coverage` — ตอนนี้ logic ที่ทดสอบมีแค่ 2 ไฟล์ ยังไม่ต้องวัด %

---

## Test Case Specification (ภาษาไทย)

> ใช้ชื่อ column "ชื่อเทสต์" เป็น `it(...)` ในไฟล์ test ตรงตัว — ครอบคลุมทุก checklist ใน Phase 2

### `wouldCreateCycle` — ตรวจจับวงวน (`tests/unit/dependencyGraph.test.ts`)

| ID | ชื่อเทสต์ | ข้อมูลขาเข้า | ผลที่คาดหวัง |
| --- | --- | --- | --- |
| TC-DG-01 | "ปฏิเสธการพึ่งพาตัวเอง (A→A)" | deps = [] เพิ่ม A→A | `true` |
| TC-DG-02 | "ตรวจจับวงวนตรง A↔B" | deps = [A→B] เพิ่ม B→A | `true` |
| TC-DG-03 | "ตรวจจับวงวนข้ามหลายชั้น A→B→C→A" | deps = [A→B, B→C] เพิ่ม C→A | `true` |
| TC-DG-04 | "ตรวจจับวงวนระยะไกล (โซ่ 5 งาน)" | deps = [A→B, B→C, C→D, D→E] เพิ่ม E→A | `true` |
| TC-DG-05 | "DAG รูป diamond ต้องไม่ report cycle" | deps = [A→B, A→C, B→D, C→D] เพิ่ม A→D | `false` |
| TC-DG-06 | "วงวนคนละกลุ่มงานไม่กระทบกัน" | deps = [A→B, B→C, C→A, D→E] เพิ่ม D→A | `false` (A ติด cycle กับ B/C อยู่แล้ว) |
| TC-DG-07 | "กราฟว่าง ไม่เจอวงวน" | deps = [] เพิ่ม A→B | `false` |

### `blockedBy` / `isBlocked` — สถานะถูกบล็อก (ไฟล์เดียวกัน)

| ID | ชื่อเทสต์ | ข้อมูลขาเข้า | ผลที่คาดหวัง |
| --- | --- | --- | --- |
| TC-BL-01 | "ไม่มี dependency ไม่ถูกบล็อก" | deps ของ X = [] | `blockedBy` = [], `isBlocked` = `false` |
| TC-BL-02 | "งาน in_progress ที่รออยู่ ทำให้ถูกบล็อก" | X→P (P = in_progress) | คืน `[P]`, `isBlocked` = `true` |
| TC-BL-03 | "งาน done ไม่บล็อก" | X→P (P = done) | คืน [], `false` |
| TC-BL-04 | "งาน released ไม่บล็อก" | X→P (P = released) | คืน [], `false` |
| TC-BL-05 | "งาน cancelled ไม่บล็อก" | X→P (P = cancelled) | คืน [], `false` |
| TC-BL-06 | "ถูกบล็อกโดยหลายงานพร้อมกัน คืนครบทุกงาน" | X→P1 (todo), X→P2 (in_progress) | คืน `[P1, P2]` |
| TC-BL-07 | "ผสม done + เปิดอยู่ คืนเฉพาะที่ยังเปิด" | X→P1 (done), X→P2 (todo) | คืน `[P2]` |
| TC-BL-08 | "dep ชี้ไป task ที่ไม่มีใน map ไม่ crash" | X→Ghost, tasks ไม่มี Ghost | คืน [], `false` |

### Phase helpers (`tests/unit/phase.test.ts`)

| ID | ชื่อเทสต์ | ผลที่คาดหวัง |
| --- | --- | --- |
| TC-PH-01 | "TASK_PHASE_ORDER ตรงกับ CHECK constraint ใน migration 029" | ครบ 7 ค่า: requirements < analysis < design < development < testing < deployment < done |
| TC-PH-02 | "ลำดับ phase เพิ่มทีละขั้นไม่มีสะดุด" | ค่า `phase_order` monotonic ตาม TC-PH-01 |
| TC-PH-03 | "taskPhaseMeta คืน label/icon/color ครบทุก phase" | ทุกค่าใน `TASK_PHASE_VALUES` → meta ไม่เป็น undefined, field ไม่ empty |
| TC-PH-04 | "taskPhaseMeta คืน undefined เมื่อ phase เป็น null/undefined" | `taskPhaseMeta(null)` → `undefined` |
| TC-PH-05 | "TASK_PHASE_VALUES ไม่มีค่าซ้ำ" | unique ครบ |

---

## Phase 3: Integrate & Close

- [x] อัปเดต Phase 6 ของ `sub-plan-task-dependency-gantt.md` ให้แยกข้อ [auto] / [manual] (ทำไปแล้ว ณ ตอนสร้าง plan นี้ — คงสถานะไว้)
- [x] ติ๊ก checklist ไฟล์นี้เมื่อแต่ละข้อเสร็จ

---

## Deferred — จงใจยังไม่ทำ (YAGNI)

| งาน | ทำเมื่อ |
| --- | --- |
| Component test (TaskCard blocked badge) ด้วย @vue/test-utils + happy-dom | เมื่อ UI logic นี้มี bug จริง หรือ Phase 3 แตะ TaskCard |
| E2E Playwright + Supabase seed (Gantt grouping, dashboard, responsive) | หลัง Phase 3–5 ของ main plan จบ (ตอนนี้ target ยังไม่มีในโค้ด) |
| DB trigger test (`check_circular_dependency()`) | manual ผ่าน `supabase db reset`local ตอน migrate — ยังไม่ worth ตั้ง pgTAP |

---

## Appendix: ไฟล์ที่กระทบ

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `package.json` | +vitest (devDep), +`test` / `test:watch` scripts |
| `vitest.config.ts` | ใหม่ — node env + alias `~` |
| `app/utils/dependencyGraph.ts` | ใหม่ — pure functions ย้ายจาก useCollaboration |
| `app/composables/useCollaboration.ts` | `useDependencyGraph()` เรียก utils แทน (瘦身, พฤติกรรมเดิม) |
| `tests/unit/dependencyGraph.test.ts` | ใหม่ |
| `tests/unit/phase.test.ts` | ใหม่ |
| `.gitignore` | +`reports/` |
