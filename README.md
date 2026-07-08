# Helm PM

ระบบ Project Management สำหรับทีมเล็ก — **steer the ship**

Helm ช่วยแจกงานให้ทีม ดูภาพรวมด้วย Gantt/Timeline และจัดการงานส่วนตัวผ่าน My Planner

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | Nuxt 3 + TypeScript + Nuxt UI |
| Runtime | **Bun** |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Deploy | Cloudflare Pages (Nitro) |

## ฟีเจอร์

- แจกงานให้ทีม (assignee, status, due date)
- Kanban board พร้อม realtime sync
- My Planner (Today / This Week / Inbox / Focus)
- Gantt / Timeline
- Calendar view
- Subtasks, labels, priority, search
- Comments, notifications, attachments
- Milestones และ task dependencies

---

## ความต้องการเบื้องต้น

ติดตั้งเครื่องมือเหล่านี้ก่อนเริ่ม:

- [Bun](https://bun.sh) 1.1+ (`curl -fsSL https://bun.sh/install | bash`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (แนะนำ — ใช้ deploy migration ได้สะดวก)
- บัญชี [Supabase](https://supabase.com) (free tier พอใช้)
- บัญชี [Cloudflare](https://cloudflare.com) (สำหรับ deploy — ทำทีหลังได้)

---

## 1. Clone และติดตั้ง dependencies

```bash
git clone https://github.com/chinnatan/helm-pm.git
cd helm-pm
bun install
```

---

## 2. สร้างโปรเจกต์ Supabase

### 2.1 สร้าง project บน Supabase Dashboard

1. ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard)
2. กด **New Project**
3. ตั้งชื่อ เช่น `helm-pm` เลือก region ใกล้ไทย (เช่น Singapore)
4. ตั้งรหัสผ่าน Database แล้วรอจน project พร้อม (~2 นาที)

### 2.2 คัดลอก API keys

ไปที่ **Project Settings → API** แล้วจดค่าเหล่านี้:

| ค่า | ใช้ทำอะไร |
|-----|-----------|
| **Project URL** | `SUPABASE_URL` |
| **anon public** | `SUPABASE_KEY` (ใช้ฝั่ง frontend) |
| **service_role** | `SUPABASE_SERVICE_ROLE_KEY` (ใช้เฉพาะ server-side / migration — **ห้ามเปิดเผย**) |

### 2.3 ตั้งค่า environment

```bash
cp .env.example .env
```

แก้ไฟล์ `.env`:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

NUXT_PUBLIC_APP_URL=http://localhost:3000
NUXT_DEV_PORT=3000
```

---

## 3. รัน Database Migrations

มี 2 วิธี — เลือกวิธีใดวิธีหนึ่ง

### วิธี A: Supabase CLI (แนะนำ)

```bash
# login ครั้งแรก
supabase login

# เชื่อมกับ remote project (ใส่ project ref จาก Dashboard → Settings → General)
supabase link --project-ref <your-project-ref>

# push migrations ขึ้น Supabase
supabase db push
```

ไฟล์ migration อยู่ใน `supabase/migrations/`:

- `001_initial_schema.sql` — ตาราง, triggers, indexes, realtime
- `002_rls_policies.sql` — Row Level Security policies

### วิธี B: SQL Editor (ไม่ต้องใช้ CLI)

1. เปิด Supabase Dashboard → **SQL Editor**
2. เปิดไฟล์ `supabase/migrations/001_initial_schema.sql` คัดลอกทั้งหมด → กด **Run**
3. เปิดไฟล์ `supabase/migrations/002_rls_policies.sql` คัดลอกทั้งหมด → กด **Run**

---

## 4. ตั้งค่า Authentication

ไปที่ **Authentication → Providers** ใน Supabase Dashboard:

### Email (เปิดอยู่แล้วโดย default)

- เปิด **Email** provider
- ถ้าทดสอบ local: ปิด **Confirm email** ชั่วคราวได้ที่ **Authentication → Providers → Email**

### Google OAuth (optional)

1. สร้าง OAuth Client ที่ [Google Cloud Console](https://console.cloud.google.com/)
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. ใส่ Client ID / Secret ใน Supabase → **Authentication → Providers → Google**

### Redirect URLs

ไปที่ **Authentication → URL Configuration** แล้วเพิ่ม:

```
http://localhost:3000/confirm
http://localhost:3000/**
```

เมื่อ deploy production ให้เพิ่ม URL จริงด้วย เช่น `https://helm.yourdomain.com/confirm`

---

## 5. สร้าง Storage Bucket (สำหรับแนบไฟล์)

1. ไปที่ **Storage** ใน Supabase Dashboard
2. กด **New bucket**
3. ตั้งชื่อ `attachments`
4. เปิด **Public bucket** (หรือตั้ง policy เองถ้าต้องการ private)
5. ถ้าใช้ public bucket ไม่ต้องตั้ง policy เพิ่ม — ถ้า private ให้เพิ่ม policy ให้ authenticated users อัปโหลด/อ่านได้

---

## 6. รัน Dev Server

```bash
bun run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

### ทดสอบครั้งแรก

1. กด **สมัครสมาชิก** ด้วยอีเมล/รหัสผ่าน
2. ระบบจะสร้างให้อัตโนมัติ:
   - `profiles` (โปรไฟล์ผู้ใช้)
   - `workspaces` ชื่อ "My Workspace"
   - labels เริ่มต้น (Bug, Feature, Improvement, Documentation)
3. สร้าง Project → เพิ่ม Task → ลอง Kanban / My Planner

---

## 7. Deploy ไป Cloudflare Pages

### Build

```bash
bun run build
```

### Deploy ด้วย Wrangler

```bash
bunx wrangler pages deploy dist
```

หรือใช้ script รวม:

```bash
bun run deploy
```

### ตั้งค่า Environment Variables บน Cloudflare

ไปที่ Cloudflare Dashboard → **Workers & Pages → helm-pm → Settings → Environment variables**

| Variable | ค่า |
|----------|-----|
| `SUPABASE_URL` | Project URL จาก Supabase |
| `SUPABASE_KEY` | anon public key |
| `NUXT_PUBLIC_APP_URL` | `https://helm.yourdomain.com` |

อย่าลืมเพิ่ม production URL ใน Supabase **Redirect URLs** ด้วย

### Custom Domain (optional)

ตั้ง subdomain เช่น `helm.yourdomain.com` คู่กับ `pos.yourdomain.com` ที่มีอยู่

---

## โครงสร้างโปรเจกต์

```
helm-pm/
├── app/
│   ├── pages/           # หน้าเว็บ (routes)
│   ├── components/      # UI components
│   ├── composables/     # business logic (useTasks, usePlanner, ...)
│   ├── layouts/         # layout หลัก + auth
│   ├── middleware/      # auth guard
│   └── types/           # TypeScript types + Supabase schema
├── supabase/
│   ├── migrations/      # SQL migrations
│   └── config.toml      # Supabase CLI config
├── nuxt.config.ts
├── Taskfile.yml         # คำสั่งรันโปรเจกต์ (task)
├── wrangler.toml        # Cloudflare deploy
└── package.json
```

---

## คำสั่งที่ใช้บ่อย

ใช้ [Task](https://taskfile.dev) เป็นหลัก (ติดตั้ง: `brew install go-task`) หรือรัน `bun` โดยตรงก็ได้

| คำสั่ง | ทำอะไร |
|--------|--------|
| `task` | แสดงคำสั่งทั้งหมด |
| `task setup` | setup ครั้งแรก (install + สร้าง `.env`) |
| `task dev` | รัน dev server |
| `task build` | build สำหรับ production |
| `task typecheck` | ตรวจ TypeScript |
| `task check` | typecheck + build |
| `task preview` | preview build local |
| `task deploy` | build + deploy Cloudflare |
| `task supabase:push` | push migrations ขึ้น remote |
| `task supabase:link -- <project-ref>` | เชื่อม Supabase CLI กับ project |
| `task clean` | ลบ build cache |

หรือใช้ Bun โดยตรง:

| คำสั่ง | ทำอะไร |
|--------|--------|
| `bun install` | ติดตั้ง dependencies |
| `bun run dev` | รัน dev server |
| `bun run build` | build สำหรับ production |
| `bun run typecheck` | ตรวจ TypeScript |
| `bun run preview` | preview build local |
| `bun run deploy` | build + deploy Cloudflare |
| `supabase db push` | push migrations ขึ้น remote |
| `supabase db reset` | reset DB local (ถ้าใช้ Supabase local) |

---

## แก้ปัญหาที่พบบ่อย

### Login แล้ว redirect กลับ login

- ตรวจว่า `NUXT_PUBLIC_APP_URL` ตรงกับ URL ที่เปิดจริง
- ตรวจ **Redirect URLs** ใน Supabase Auth settings

### ไม่เห็นข้อมูล / permission denied

- ตรวจว่ารัน migration `002_rls_policies.sql` แล้ว
- ตรวจว่า user เป็นสมาชิก workspace (`workspace_members`)

### อัปโหลดไฟล์ไม่ได้

- ตรวจว่าสร้าง bucket `attachments` แล้ว
- ตรวจ Storage policies ใน Supabase

### Build ล้มบน Cloudflare

- ตั้ง env variables ครบ (`SUPABASE_URL`, `SUPABASE_KEY`)
- เปิด **Node.js compatibility** ใน Cloudflare Pages settings ถ้าจำเป็น

---

## License

Private — ใช้ภายในทีม
