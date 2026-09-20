# PLAND.md — Helm PM Feature Map & Roadmap

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

### 3. Customers (ลูกค้า)
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Customer CRUD | สร้าง/แก้ไข/ลบ ลูกค้า พร้อมบริษัท, อีเมล, หมายเหตุ |
| Customer Status | active / archived |
| Meetings | บันทึกการประชุมกับลูกค้า (วันที่, สรุป) |
| Requirements | บันทึกความต้องการของลูกค้า, ผูกกับ meeting + task |

### 4. Projects
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Project CRUD | สร้างโปรเจกต์, กำหนดสี, ผูกกับลูกค้า |
| Project Owner | กำหนดเจ้าของโปรเจกต์ |
| Archive Project | เก็บโปรเจกต์ที่เสร็จแล้ว |
| Labels | ป้ายกำกับระดับ workspace (Bug, Feature, Improvement, Documentation + เพิ่มเอง) |

### 5. Tasks (งาน)
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Task CRUD | สร้าง/แก้ไข/ลบงาน พร้อม title, description (rich-text), priority, status |
| Task Statuses | backlog → todo → in_progress → ready_for_test → testing → done → release / cancelled |
| Task Priority | low / medium / high / urgent |
| Assignee + Tester | มอบหมายผู้พัฒนา + ผู้ทดสอบ |
| Milestones | ผูกงานกับ milestone (date range + status) |
| Customer Link | ผูกงานกับลูกค้า |
| Due Date + Start Date | กำหนดวันเริ่มและวันครบกำหนด |
| Estimate Hours | ประเมินเวลา (ถ้าไม่ระบุ ใช้ default ตาม priority) |
| Subtasks | สร้าง subtask พร้อม assignee, tester, status, labels, description, hours, dates |
| Comments | แสดงความคิดเห็น (rich-text + image upload) |
| Attachments | แนบไฟล์ผ่าน Supabase Storage |
| Activity Log | บันทึกประวัติการเปลี่ยนแปลง (status, assignee, field changes) |
| Task Dependencies | กำหนดงานที่ต้องทำก่อน-หลัง → [sub-plan-task-dependency-gantt.md](./plans/sub-plan-task-dependency-gantt.md) (Phase 2) |
| Labels per Task | ติดป้ายกำกับหลายอัน |
| Realtime Sync | Kanban board sync แบบ realtime ผ่าน Supabase Realtime |

### 6. Views (มุมมอง)
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Kanban Board | ลาก-วาง task ตาม status (vue-draggable-plus) |
| List View | ดูงานเป็นรายการ |
| Calendar View | ดูงานบนปฏิทิน |
| Gantt / Timeline | ดูงานแบบ Gantt chart (frappe-gantt) → [sub-plan-task-dependency-gantt.md](./plans/sub-plan-task-dependency-gantt.md) (Phase 3) |

### 7. My Planner
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Today | งานวันนี้ |
| This Week | งานสัปดาห์นี้ |
| Inbox | งานที่ยังไม่ได้จัดกำหนด |
| Focus | งานที่ pin / สำคัญ |
| Pin Task | Pin งานที่ชอบ |
| Schedule Date | จัดกำหนดงานส่วนตัว |

### 8. Team Capacity
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| Weekly Capacity | กำหนดชั่วโมงทำงานต่อสัปดาห์ของสมาชิก |
| Month Capacity | กำหนดชั่วโมงรายเดือนต่อคน |
| Month Calendar | ตั้งวันทำงาน / หยุด / ประชุม / ลา / เหตุการณ์บริษัท ต่อเดือน |
| Load Bar | แสดงภาระงาน (load) ของสมาชิก |
| Week Chart | แผนภูมิภาระงานรายสัปดาห์ |
| Month Spreadsheet | ตารางภาระงานรายเดือน |
| Capacity Alerts | แจ้งเตือนเมื่อ load เกิน capacity |

### 9. Notifications
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| In-App Notifications | กระดิ่งในแอป |
| Web Push (OneSignal) | Push notification ผ่าน browser |
| Task Events | แจ้งเมื่อ assign, status change, due date change, etc. |
| Notifications Worker | Cloudflare Worker รับ webhook จาก Supabase → ส่ง OneSignal |

### 10. Infrastructure
| ฟีเจอร์ | รายละเอียด |
|---------|-------------|
| PWA | ติดตั้งเป็นแอป (via @vite-pwa/nuxt) |
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
| **Dashboard / Overview** | หน้าหลักรวมภาพรวม — งานค้าง, งานเลยกำหนด, ภาระทีม, progress รายโปรเจกต์ → [sub-plan-task-dependency-gantt.md](./plans/sub-plan-task-dependency-gantt.md) (Phase 4) |
| **Task Filters & Bulk Actions** | กรองตาม assignee / label / priority / date + เลือกหลายงานแล้วแก้พร้อมกัน |
| **Task Templates** | สร้าง template สำหรับงานที่ทำซ้ำ ๆ (ลดงาน manual) |
| **Export / Report** | ส่งออก CSV/PDF สำหรับรายงานความคืบหน้า, burn-down, workload |
| **Search (Global)** | ค้นหา task / project / customer จากทุกที่ในแอป |
| **Dark Mode** | รองรับการแสดงผลแบบมืด |

### Priority: Medium (ควรทำถัดไป)

| ฟีเจอร์ | เหตุผล |
|---------|--------|
| **Time Tracking** | จับเวลาจริงที่ทำงาน (timer) เปรียบเทียบกับ estimate |
| **Recurring Tasks** | สร้างงานที่เกิดซ้ำอัตโนมัติ (รายสัปดาห์/รายเดือน) |
| **Task Dependencies Visualization** | แสดง dependency เป็นเส้นบน Gantt (ปัจจุบันมี data แต่ไม่ได้แสดง) → [sub-plan-task-dependency-gantt.md](./plans/sub-plan-task-dependency-gantt.md) (Phase 2, 3) |
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
| Gantt | frappe-gantt |
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
| `meetings` | การประชุม |
| `requirements` | ความต้องการ |
| `projects` | โปรเจกต์ |
| `labels` | ป้ายกำกับ |
| `milestones` | จุดสำคัญ |
| `tasks` | งานหลัก |
| `subtasks` | งานย่อย |
| `comments` | ความคิดเห็น |
| `attachments` | ไฟล์แนบ |
| `activity_logs` | บันทึกกิจกรรม |
| `task_dependencies` | ความสัมพันธ์ระหว่างงาน |
| `task_labels` | ป้ายของงาน |
| `user_task_preferences` | ค่าตั้งส่วนตัว (pin, schedule) |
| `notifications` | แจ้งเตือน |
| `audit_logs` | Audit log |
| `team_capacities` | ภาระงานรายสัปดาห์ |
| `member_month_capacities` | ภาระงานรายเดือน |
| `workspace_month_calendars` | ปฏิทินรายเดือนของ workspace |
