# App Theme Primary Blue — ปรับ theme สีหลักของแอปเป็น `rgba(37, 99, 235, 1)`

## Business Goals

- ทำให้ visual identity ของทั้งแอปใช้ primary blue เดียวกันอย่างสม่ำเสมอ
- ให้ Nuxt UI, Tailwind utility classes, browser theme color และ PWA manifest แสดงสีหลักเดียวกัน
- รักษาความหมายของสี semantic เช่น error, success, warning และสีข้อมูลของ project/label ไม่ให้ถูกเปลี่ยนเป็น primary โดยไม่จำเป็น

---

## Phase 1: Primary Theme Tokens

### Tailwind และ Nuxt UI

- [x] เปลี่ยนชุด `ocean-*` ใน `app/assets/css/main.css` ให้เป็น blue palette ที่มี `#2563EB` เป็น primary (`rgba(37, 99, 235, 1)`) และยังรองรับ shade ที่ใช้ใน utility classes ปัจจุบัน
- [x] ตรวจและปรับ `--color-brand` ให้ชี้ไปยัง shade primary ที่เหมาะสมของ palette ใหม่
- [x] ตรวจ `app/app.config.ts` ให้ `ui.colors.primary` ใช้ token/palette ใหม่โดยไม่ทำให้ `neutral` เปลี่ยนความหมาย

---

## Phase 2: Application-Wide Color Usage

### Primary และ neutral usage

- [x] ค้นหาและเปลี่ยนจุดใช้ `ocean-*`/สี teal เดิมใน layouts, pages และ components ให้สอดคล้องกับ primary blue token ใหม่
- [x] ตรวจสี hard-coded ใน `app/types/index.ts` และ composables แยกเป็นสีของข้อมูลผู้ใช้/label/project ออกจากสีของ UI theme
- [x] ตรวจปุ่ม, link, active navigation, focus state, loading state, background และ border ให้มี contrast ที่อ่านได้ทั้ง desktop และ mobile

### Semantic colors

- [x] คงสี `error`, `success`, `warning`, `info` และสีสถานะ task ตาม semantic เดิม เว้นแต่พบจุดที่ถูกใช้แทน primary อย่างไม่ถูกต้อง
- [x] ตรวจ component ของ Nuxt UI ที่ใช้ `color="primary"`/`color="neutral"` ว่า resolve ไปยัง palette ใหม่โดยไม่ต้องเปลี่ยนเป็น hard-coded color

---

## Phase 3: Browser and PWA Branding

### Metadata

- [x] เปลี่ยน `theme-color` ใน `nuxt.config.ts` เป็น `#2563EB`
- [x] เปลี่ยน `pwa.manifest.theme_color` ใน `nuxt.config.ts` เป็น `#2563EB`
- [x] ตรวจ `public/icon.svg` เฉพาะกรณีที่มีสี brand เดิมฝังอยู่และเป็นส่วนหนึ่งของ app branding ไม่ใช่สีเนื้อหาหรือสถานะ

---

## Phase 4: Review & Quality Assurance

- [x] ตรวจไม่ให้มี primary teal เดิมหลงเหลือใน source ที่ใช้กับ UI หรือ metadata
- [x] รัน `bun run typecheck`
- [x] รัน `bun test`
- [x] รัน `bun run build`
- [ ] ตรวจหน้าหลัก, login, project views, team, customers และ planner ด้วย primary/neutral/semantic states ทั้ง desktop และ mobile — คงเป็น visual check ด้วยตา (ไม่ได้รัน E2E/browser)
- [x] อัปเดต checklist นี้พร้อมผลลัพธ์หลัง implement ครบทุก phase

### ผลลัพธ์

- `ocean-500` = `#2563EB`; `--color-brand` ชี้ `ocean-500`; `app.config.ts` คง `primary: "ocean"` / `neutral: "slate"`
- `ocean-*` class ไม่ต้อง rename — token ใหม่ถูกใช้ทั้งแอป
- hex teal ที่เป็น UI/PWA เปลี่ยนแล้ว; `PROJECT_COLORS` คงเดิม (สีข้อมูลโปรเจกต์)
- typecheck / `bun run test` (20) / build ผ่าน

---

## Appendix: Current State Analysis (จาก Phase 0 research)

### Current theme sources

| ไฟล์ | สถานะปัจจุบัน | ขอบเขตที่คาดว่าจะกระทบ |
|------|---------------|--------------------------|
| `app/assets/css/main.css` | ประกาศ `ocean-50` ถึง `ocean-950`, `--color-brand`, body background | แหล่งหลักของ palette และ background |
| `app/app.config.ts` | `ui.colors.primary = "ocean"`, `neutral = "slate"` | mapping ของ Nuxt UI |
| `app/layouts/default.vue` และ `app/pages/**/*.vue` | ใช้ `ocean-*` และ Tailwind neutral จำนวนมาก | active navigation, brand, links และ surfaces |
| `app/components/**/*.vue` | ใช้สี UI และสี semantic กระจายตาม component | ตรวจเฉพาะจุด primary/neutral |
| `app/types/index.ts` | มีสีของ label/project หลายชุด รวมถึง `#2563eb` อยู่แล้ว | ไม่เปลี่ยนสีข้อมูลโดยอัตโนมัติ |
| `nuxt.config.ts` | `theme-color` และ PWA `theme_color` เป็น `#0B6E7A` | เปลี่ยนเป็น primary blue |
| `public/icon.svg` | ยังต้องตรวจสี brand ใน asset | เปลี่ยนเฉพาะถ้าเป็น brand color เดิม |

### Design decisions

- ใช้ `#2563EB` ใน CSS/config เพราะเป็นค่าเดียวกับ `rgba(37, 99, 235, 1)` เมื่อ alpha เท่ากับ `1` และเข้ากับ Tailwind/Nuxt UI token ได้ตรงกว่า
- ไม่สร้าง dark mode หรือ color customization เพิ่ม เพราะไม่อยู่ใน requirement นี้
- ไม่เปลี่ยนสี status, alert และ label/project ที่มีความหมายเฉพาะ เพื่อป้องกันความหมายของข้อมูลเปลี่ยน
- ไม่ไล่เปลี่ยนทุก `slate-*` เป็น blue เพราะ `slate` เป็น neutral palette ไม่ใช่ primary และการเปลี่ยนทั้งหมดจะกระทบ contrast/ความหมายของ surface โดยไม่จำเป็น

### Expected files

- `app/assets/css/main.css`
- `app/app.config.ts`
- `app/layouts/default.vue`
- `app/pages/**/*.vue` และ `app/components/**/*.vue` เฉพาะจุดที่ใช้ primary เดิมหรือ hard-coded brand color
- `app/types/index.ts` เฉพาะกรณีพบสี UI theme ที่ไม่ใช่สีข้อมูล
- `nuxt.config.ts`
- `public/icon.svg` เฉพาะกรณีจำเป็น
