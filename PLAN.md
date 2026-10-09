# PLAN.md — Helm PM Feature Map & Roadmap

> ระบบ Project Management สำหรับทีมเล็ก — **steer the ship**

---

## Current Features (ฟีเจอร์ที่มีอยู่แล้ว)

### 1. Authentication & User Management
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Email/Password Auth | สมัคร/เข้าสู่ระบบผ่าน Supabase Auth |
| Profile Management | แก้ไขชื่อ, นามสกุล, รูปโปรไฟล์ (avatar) |
| Notification Preferences | เปิด/ปิด Web Push, mention, task assigned, status changed, etc. |
| Task Card Density | เลือกการแสดงผลแบบ compact / standard / detailed |

### 2. Multi-Workspace
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| สร้าง/สลับ Workspace | แยกทีม/องค์กร ลูกค้าและโปรเจกต์ไม่ปน |
| Workspace Members | จัดการสมาชิก + บทบาท (admin, manager, member, viewer) |
| Invite System | เชิญผ่านลิงก์ (open) หรือผูกอีเมล, กำหนดวันหมดอายุ + max uses |
| Job Role | กำหนดบทบาทสมาชิก (developer, tester, designer, pm, other) |
| Audit Log | ดูประวัติการสร้าง/แก้ไข workspace, member, invite, project, customer, capacity |

### 3. Customers, Features & Rollouts (แกนหลักของโดเมน)
> ดู [CONTEXT.md](./CONTEXT.md) (glossary) และ [ADR 0001](./docs/adr/0001-rollout-centric-domain-reset.md) — [sub-plan-rollout-domain-a.md](./plans/sub-plan-rollout-domain-a.md)

| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Customer CRUD | สร้าง/แก้ไข/archive/ลบ ลูกค้า + หน้ารายละเอียดแสดง Rollout และงานค้าง |
| Features | รายการฟีเจอร์ของ Vinai QMS (เพิ่ม/เปลี่ยนชื่อ/เรียง/archive) ที่ `/settings/features` |
| Rollouts | จุดตัด Customer × Feature พร้อม Rollout status: planned → developing → testing → production / cancelled |
| Commitments | คำสัญญาต่อลูกค้าระดับเดือนต่อ Rollout, เลื่อนเดือนต้องมีเหตุผลและเก็บประวัติ |
| Overview Matrix | หน้า `/` ลูกค้า × เดือน (สลับเป็น ฟีเจอร์ × เดือนได้) พร้อมจำนวนงานเปิด และแจ้งงานที่ยังไม่ผูก |

### 4. Tasks (งาน)
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Task CRUD | title, description (rich-text), priority, status — ฟอร์ม split layout แบบ Jira → [sub-plan-task-form-jira-split-layout.md](./plans/sub-plan-task-form-jira-split-layout.md) |
| Task Statuses | inbox → todo → in_progress → testing → done / cancelled (การปล่อยใช้งานอยู่ที่ Rollout status) |
| Task Types | feature / bug / infra / customer-request |
| Task Scope | ผูก Customer และ/หรือ Feature ได้ไม่บังคับ (ไม่ผูก = แสดงเป็น "ยังไม่ผูก") |
| Task Dependencies | งานที่ต้องทำก่อน-หลัง, blocked badge, กัน circular (UI + DB trigger) → [sub-plan-task-dependency-gantt.md](./plans/sub-plan-task-dependency-gantt.md) (ไม่มี UI Gantt แล้ว) |
| Filters & Bulk Actions | กรองตามลูกค้า/ฟีเจอร์/ประเภท (URL query) + label / due date + bulk แก้ status, priority, assignee, tester, labels, ลบ → [sub-plan-task-filters-bulk-actions-templates.md](./plans/sub-plan-task-filters-bulk-actions-templates.md) |
| Task Templates | บันทึกงานเป็น template + prefill ตอนสร้างงานใหม่ |
| Assignee + Tester | มอบหมายผู้พัฒนา + ผู้ทดสอบ |
| Due / Start Date, Estimate Hours | วางแผนงาน |
| Subtasks | assignee, tester, status, labels, description, hours, dates |
| Comments / Attachments / Activity Log | rich-text + image, Supabase Storage, ประวัติการเปลี่ยนแปลง (รวม customer/feature) |
| Labels | ป้ายกำกับระดับ workspace |
| Realtime Sync | Kanban sync ผ่าน Supabase Realtime |

### 5. Views (มุมมอง)
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Overview Matrix | `/` ภาพรวม Rollout (ดูหัวข้อ 3) |
| Kanban Board | `/tasks/board` ลาก-วาง task ตาม status, filter งานที่ถูก block |
| List View | `/tasks/list` ตารางงาน + ตัวกรอง + bulk actions |
| Customer Detail | `/customers/[id]` Rollout และงานค้างของลูกค้า |
| Team | `/team` สมาชิก, สิทธิ์, job role, จำนวนงานค้าง/เลยกำหนด, invite link |

### 7. My Planner
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Today | งานวันนี้ |
| This Week | งานสัปดาห์นี้ |
| Inbox | งานที่ยังไม่ได้จัดกำหนด |
| Focus | งานที่ pin / สำคัญ |
| Pin Task | Pin งานที่ชอบ |
| Schedule Date | จัดกำหนดงานส่วนตัว |

### 8. Notifications
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| In-App Notifications | กระดิ่งในแอป |
| Web Push (OneSignal) | Push notification ผ่าน browser |
| Task Events | แจ้งเมื่อ assign, status change, due date change, etc. |
| Notifications Worker | Cloudflare Worker รับ webhook จาก Supabase → ส่ง OneSignal |

### 9. Infrastructure
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| PWA | ติดตั้งเป็นแอป (via @vite-pwa/nuxt) |
| Theme | Primary blue `#2563EB` สม่ำเสมอทั้ง Nuxt UI / Tailwind / PWA → [sub-plan-app-theme-primary-blue.md](./plans/sub-plan-app-theme-primary-blue.md) |
| Testing | Vitest unit (dependency graph, templates) + Playwright E2E (auth, task CRUD, dependency, filters/bulk, templates) → [sub-plan-automated-testing.md](./plans/sub-plan-automated-testing.md), [sub-plan-e2e-testing.md](./plans/sub-plan-e2e-testing.md) |
| i18n | รองรับหลายภาษา (Nuxt i18n) |
| RLS Policies | Row Level Security ทุกตาราง |
| Cloudflare Pages | Deploy ผ่าน Wrangler |
| Supabase Storage | เก็บ attachments + avatars |
| Rich Text Editor | Tiptap (image, link, markdown) |

---

## Suggested Features (ฟีเจอร์ที่ควรมีเพิ่มเติม)

### Priority: High (ควรทำก่อน)

| ฟีเจอร์ | เหตุผล |
|---------|--------|
| **Export / Report** | ส่งออก CSV/PDF สำหรับรายงานความคืบหน้า, burn-down, workload |
| **Search (Global)** | ค้นหา task / project / customer จากทุกที่ในแอป |
| **Dark Mode** | รองรับการแสดงผลแบบมืด |

### Priority: Medium (ควรทำถัดไป)

| ฟีเจอร์ | เหตุผล |
|---------|--------|
| **Time Tracking** | จับเวลาจริงที่ทำงาน (timer) เปรียบเทียบกับ estimate |
| **Recurring Tasks** | สร้างงานที่เกิดซ้ำอัตโนมัติ (รายสัปดาห์/รายเดือน) |
| **Notifications Digest** | สรุปแจ้งเตือนรายวัน/รายสัปดาห์ แทนที่จะแจ้งทุกเหตุการณ์ |
| **File Preview** | ดูรูปภาพ/PDF ใน app โดยไม่ต้องดาวน์โหลด |
| **Mention (@user)** | Tag สมาชิกใน comment + แจ้งเตือน |
| **Activity Feed** | ฟีดกิจกรรมล่าสุดของ workspace (ใครทำอะไรที่ไหน) |
| **Custom Task Statuses** | ให้แต่ละโปรเจกต์กำหนด status เองได้ |
| **Sprint / Iteration** | จัดงานเป็น sprint (start/end date, goal, velocity tracking) |

### Priority: Low (ทำทีหลังได้)

| ฟีเจอร์ | เหตุผล |
|---------|--------|
| **Integrations** | เชื่อมต่อ GitHub/GitLab (link commit → task), Google Calendar |
| **Automations** | กฎอัตโนมัติ เช่น "เมื่อ status = done → แจ้ง tester" |
| **Custom Fields** | เพิ่ม field เองใน task (เช่น severity, environment) |
| **API / Webhooks** | เปิด API ให้ระบบอื่นเรียกได้ |
| **Mobile App** | Native app หรือ React Native สำหรับมือถือ |
| **Multi-language Content** | รองรับเนื้อหาหลายภาษาใน task description |
| **AI Assist** | ช่วยสรุป comment, แนะนำ priority, สร้าง description จาก title |
| **Wiki / Docs** | หน้าเอกสารภายในโปรเจกต์ (knowledge base) |
| **Slack/Discord Integration** | ส่งแจ้งเตือนเข้า channel |
| **Workload Balancing** | แนะนำการมอบหมายงานตาม capacity + skill |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Nuxt 3 + Vue 3 + TypeScript |
| UI | Nuxt UI v3 + Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Runtime | Bun |
| Deploy | Cloudflare Pages + Wrangler |
| Notifications | Cloudflare Worker + OneSignal |
| Rich Text | Tiptap (Vue 3) |
| Drag & Drop | vue-draggable-plus |
| PWA | @vite-pwa/nuxt |
| i18n | @nuxtjs/i18n |

---

## Database Schema (Tables)

| Table | Description |
|-------|-------------|
| `profiles` | ข้อมูลผู้ใช้ |
| `workspaces` | ทีม/องค์กร |
| `workspace_members` | สมาชิก + บทบาท |
| `workspace_invites` | คำเชิญ |
| `customers` | ลูกค้า |
| `features` | ฟีเจอร์ของ Vinai QMS (migration 031) |
| `rollouts` | Customer × Feature + status |
| `commitments` | สัญญาต่อลูกค้าระดับเดือนต่อ Rollout |
| `commitment_reschedules` | ประวัติการเลื่อนเดือน |
| `labels` | ป้ายกำกับ |
| `tasks` | งานหลัก |
| `subtasks` | งานย่อย |
| `comments` | ความคิดเห็น |
| `attachments` | ไฟล์แนบ |
| `activity_logs` | บันทึกกิจกรรม |
| `task_dependencies` | ความสัมพันธ์ระหว่างงาน (มี DB trigger กัน circular) |
| `task_templates` | เทมเพลตงานระดับ workspace (migration 030) |
| `task_labels` | ป้ายของงาน |
| `user_task_preferences` | ค่าตั้งส่วนตัว (pin, schedule) |
| `notifications` | แจ้งเตือน |
| `audit_logs` | Audit log |
