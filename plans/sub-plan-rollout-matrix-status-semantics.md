# Rollout Matrix — ความหมายของสถานะที่สัญญา (Target status) กับสถานะปัจจุบัน

## Business Goals

- ภาพรวม Rollout แยกสีตามสถานะที่สัญญาไว้ของแต่ละเดือน (ฟ้า = developing, เขียว = production)
- Rollout ที่ cancelled ไม่หลอกตาว่ายังมีคำสัญญา
- เห็นทันทีเมื่อแผนสถานะขัดกันเอง หรือเดือนที่สัญญาผ่านไปแล้วแต่งานยังไม่ถึงสถานะนั้น
- การเตือนเป็นแค่คำเตือน ไม่บล็อกการบันทึก (ลูกค้าเลื่อนแผนถอยได้จริง)

ตัดสินใจแล้ว: ดู `CONTEXT.md` (Rollout status / Commitment / Target status)

---

## Phase 1: กติกาเป็น pure function

### `app/utils/rollout.ts`

- [x] เพิ่ม `commitmentWarnings(rollout, today)` คืนรายการคำเตือน 2 แบบ: `regression` (เดือนหลังมี Target status ต่ำกว่าเดือนก่อน) และ `overdue` (เดือนที่สัญญาผ่านไปแล้ว แต่ Rollout status ต่ำกว่า Target status)
- [x] Rollout ที่ cancelled คืนรายการว่างเสมอ
- [x] unit test ใน `tests/unit/rollout.test.ts` ครบ 3 กรณี: ไล่ขึ้นปกติ, ถอยหลัง, เกินกำหนด + cancelled

## Phase 2: Matrix

### `RolloutMatrix.vue`

- [x] ชิปของ Rollout ที่ cancelled ใช้สไตล์ cancelled ในทุกคอลัมน์ (ไม่ใช้สีของ Target status)
- [x] ชิปที่มีคำเตือนแสดงไอคอน/ขอบเตือน พร้อม title อธิบาย ("เกินกำหนด" / "สถานะถอยหลัง")

## Phase 3: Panel

### `RolloutPanel.vue`

- [x] ตอนเพิ่ม Commitment และตอนเลื่อนเดือน แสดงคำเตือน `regression` ในฟอร์มก่อนกดบันทึก (บันทึกได้ตามปกติ)
- [x] รายการ Commitment แสดงป้ายเตือนเมื่อเกินกำหนด

### i18n

- [x] เพิ่มข้อความเตือนใน `i18n/locales/*.json` ทุกภาษาที่มีในโปรเจกต์

## Phase 4: Review & Quality Assurance

- [x] รัน `vitest` (48 ผ่าน) และ `vue-tsc` (ไม่มี error ในไฟล์ที่แก้)
- [x] เพิ่ม e2e ใน `tests/e2e/rollouts.spec.ts`: เพิ่ม Commitment ที่ถอยหลังแล้วเห็นคำเตือนแต่บันทึกได้ (รันแล้ว ผ่าน 6/6 บน Supabase local; แก้เดือนในเทสให้อยู่ในช่วง 6 เดือนที่ matrix แสดง)
- [x] อัปเดต checklist ไฟล์นี้เป็น `[x]` และ commit

---

## Appendix: ผล research

| ไฟล์ | เกี่ยวข้อง |
|---|---|
| `app/components/rollouts/RolloutMatrix.vue` | ชิปใช้ `chipStatus(r, col)` (target_status ของเดือนนั้น) |
| `app/components/rollouts/RolloutPanel.vue` | `addCommitment`, `submitReschedule` |
| `app/composables/useCommitments.ts` | create/reschedule ไม่ต้องแก้ เพราะเตือนอย่างเดียว |
| `app/utils/rollout.ts` | ที่อยู่ของ pure function |

- Target status มี 3 ค่า (developing/testing/production) ส่วน Rollout status มี 5 ค่า เทียบลำดับด้วย index ของ `ROLLOUT_STATUS_VALUES` (production สูงสุด)
- ไม่ต้อง migration
