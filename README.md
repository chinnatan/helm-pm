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
- **หลาย Workspace** — แยกทีม/องค์กร; ลูกค้าและโปรเจกต์ไม่ปนข้าม workspace

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

### 2.2 คัดลอก API keys (แบบใหม่)

ไปที่ **Project Settings → API Keys** แล้วเลือกแท็บ **Publishable and secret API keys**

ถ้ายังไม่มี ให้กด **Create new API keys** ก่อน (สร้างคู่กับ `anon` / `service_role` แบบเก่าได้ ไม่กระทบของเดิม)

| ค่าใน Dashboard | ใส่ใน `.env` | ใช้ทำอะไร |
|-----------------|--------------|-----------|
| **Project URL** | `SUPABASE_URL` | URL ของโปรเจกต์ |
| **Publishable key** (`sb_publishable_...`) | `SUPABASE_KEY` | ฝั่ง frontend (ปลอดภัยพอที่จะเปิดเผย) |
| **Secret key** (`sb_secret_...`) | `SUPABASE_SERVICE_KEY` | เฉพาะ server-side — **ห้ามเปิดเผย / ห้าม commit** |

> ทำไมชื่อตัวแปรยังเป็น `SUPABASE_KEY`?  
> เพราะ `@nuxtjs/supabase` อ่านชื่อนี้โดยตรง — ไม่ใช่เพราะต้องใช้ `anon` แบบเก่า  
> แค่ใส่ค่าเป็น `sb_publishable_...` แทน JWT `eyJ...` ก็พอ

อย่าใช้ `anon` / `service_role` (JWT) อีกแล้ว — จะถูก deprecate ในช่วงปลายปี 2026

### 2.3 ตั้งค่า environment

```bash
cp .env.example .env
```

แก้ไฟล์ `.env`:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxxxxxx
SUPABASE_SERVICE_KEY=sb_secret_xxxxxxxx

NUXT_PUBLIC_APP_URL=http://localhost:5100
NUXT_DEV_PORT=5100
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
- ตอนสมัครต้องกรอก **ชื่อ** และ **นามสกุล** (บังคับ) ส่วนรูปโปรไฟล์เป็นทางเลือก

### Redirect URLs

ไปที่ **Authentication → URL Configuration** แล้วเพิ่ม:

```
http://localhost:5100/confirm
http://localhost:5100/**
```

เมื่อ deploy production ให้เพิ่ม URL จริงด้วย เช่น `https://helm.yourdomain.com/confirm`

---

## 5. สร้าง Storage Bucket

### แนบไฟล์ในงาน (`attachments`)

1. ไปที่ **Storage** ใน Supabase Dashboard
2. กด **New bucket**
3. ตั้งชื่อ `attachments`
4. เปิด **Public bucket** (หรือตั้ง policy เองถ้าต้องการ private)
5. ถ้าใช้ public bucket ไม่ต้องตั้ง policy เพิ่ม — ถ้า private ให้เพิ่ม policy ให้ authenticated users อัปโหลด/อ่านได้

### รูปโปรไฟล์ (`avatars`)

แอปใช้ `getPublicUrl` ดังนั้นต้องเป็น **Public bucket** + มี SELECT ให้ทุกคนอ่านได้

1. สร้าง bucket ชื่อ `avatars`
2. เปิด **Public bucket** (สำคัญ — ถ้า Private รูปใน `<img>` จะไม่ขึ้น)
3. รัน migration `012_avatars_storage_policies.sql` หรือตั้ง policy ดังนี้:

| Operation | Role | เงื่อนไข |
|-----------|------|----------|
| **SELECT** | `public` (ทุกคน) | `bucket_id = 'avatars'` |
| **INSERT / UPDATE / DELETE** | `authenticated` | โฟลเดอร์แรก = `auth.uid()` |

อย่าใช้ SELECT แบบ “own เท่านั้น” — คนอื่นในทีม (และ `<img>` ที่ไม่ส่ง JWT) จะเห็นรูปไม่ได้

ลบ policy เก่าที่ชื่อคล้าย `avatars_* …` ใน Dashboard ก่อน ถ้าซ้ำกับ migration

---

## 6. รัน Dev Server

```bash
bun run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:5100](http://localhost:5100)

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
| `SUPABASE_KEY` | Publishable key (`sb_publishable_...`) |
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
| `task dev` | รัน dev server (ใช้ `.env` — มักเป็น remote) |
| `task dev:local` | เริ่ม Supabase local แล้วรัน Nuxt (ไม่กิน B/W cloud) |
| `task build` | build สำหรับ production |
| `task typecheck` | ตรวจ TypeScript |
| `task check` | typecheck + build |
| `task preview` | preview build local |
| `task deploy` | build + deploy Cloudflare |
| `task supabase:start` | รัน Supabase local stack (ต้องมี Docker) |
| `task supabase:stop` | หยุด Supabase local |
| `task supabase:status` | แสดง URL / keys ของ local |
| `task supabase:reset` | reset DB local + รัน migrations |
| `task supabase:push` | push migrations ขึ้น remote |
| `task supabase:link -- <project-ref>` | เชื่อม Supabase CLI กับ project |
| `task clean` | ลบ build cache |
| `task notifications:dev` | รัน notifications worker local (Wrangler) |
| `task notifications:setup` | สร้าง `.dev.vars` + แสดงค่า Webhook สำหรับ Supabase |
| `task notifications:webhook-hint` | แสดง URL/header ของ Webhook อีกครั้ง |
| `task notifications:deploy` | deploy notifications worker ขึ้น Cloudflare |

หรือใช้ Bun โดยตรง:

| คำสั่ง | ทำอะไร |
|--------|--------|
| `bun install` | ติดตั้ง dependencies |
| `bun run dev` | รัน dev server |
| `bun run build` | build สำหรับ production |
| `bun run typecheck` | ตรวจ TypeScript |
| `bun run preview` | preview build local |
| `bun run deploy` | build + deploy Cloudflare |
| `bun run notifications:dev` | รัน notifications worker local |
| `bun run notifications:deploy` | deploy notifications worker |
| `supabase db push` | push migrations ขึ้น remote |
| `supabase db reset` | reset DB local (ถ้าใช้ Supabase local) |

---

## ทดสอบบน localhost

แอป Nuxt กับ **notifications worker** เป็นคนละ process — ถ้าจะทดสอบ **in-app กระดิ่ง + Web Push (OneSignal)** ให้เปิด **สองเทอร์มินัล**:

| เทอร์มินัล | คำสั่ง | ทำอะไร |
|------------|--------|--------|
| 1 | `task dev` **หรือ** `task dev:local` | แอปที่ `http://localhost:5100` |
| 2 | `task notifications:dev` | Worker ที่ `http://localhost:8787` (รับ webhook จาก Supabase → ส่ง OneSignal) |

### เลือก `dev` หรือ `dev:local`?

| คำสั่ง | Supabase ที่แอปใช้ | เหมาะเมื่อ |
|--------|---------------------|------------|
| **`task dev`** | ตาม `.env` รากโปรเจกต์ (มักเป็น **โปรเจกต์ cloud**) | ทดสอบกับ DB จริง / ทีมใช้ร่วมกันอยู่แล้ว |
| **`task dev:local`** | **Supabase ใน Docker** (`task supabase:start` ให้อัตโนมัติ) | ไม่อยากยิง cloud / ทดสอบ migration บนเครื่อง |

**เข้าใจคร่าวๆ:** ใช่ — รัน **`task notifications:dev` เสมอ** เมื่อทดสอบ push; คู่กับ **`task dev:local`** ถ้าต้องการ stack ทั้งหมดบนเครื่อง หรือ **`task dev`** ถ้าแอปชี้ Supabase cloud

Worker ต้องคุยกับ **Supabase ตัวเดียวกับที่แอปใช้** — ดู `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` ใน `workers/notifications/.dev.vars`:

- ใช้ **`task dev`** → `.dev.vars` ควรชี้ URL/key **cloud** (มักได้จาก `task notifications:setup` ที่อ่าน `.env` ราก)
- ใช้ **`task dev:local`** → หลัง `supabase start` ให้ใส่ค่าจาก `task supabase:status` (หรือ `supabase status -o env`) ลง `.dev.vars` แล้วตั้ง **Database Webhook ใน Studio local** (`http://127.0.0.1:54323`)

### ครั้งแรก (ก่อนเทส push)

1. `task notifications:setup` — สร้าง `.dev.vars` + สุ่ม `WEBHOOK_SECRET`
2. `task notifications:webhook-hint` — copy URL + header ไปวางใน **Database → Webhooks** (ตาราง `notifications`, event **Insert**)
3. ใส่ `NUXT_PUBLIC_ONESIGNAL_APP_ID` ใน `.env` รากโปรเจกต์; ในแอป **Edit profile → Enable notifications**

**OneSignal กับ localhost:** `NUXT_PUBLIC_APP_URL=http://localhost:5100` ใน `.env` **ไม่ได้** เปลี่ยนโดเมนที่ OneSignal อนุญาต — แต่ละ App ID ผูกกับ **Site URL ใน OneSignal Dashboard** เท่านั้น (เช่น `https://helm.zkcnt.com`) ถ้าเปิดแอปที่ `http://localhost:5100` แล้วขึ้น *Can only be used on: …* ให้สร้าง **แอป OneSignal แยกสำหรับ dev**:

1. Dashboard → New App/Website → Web → Custom Code  
2. **Site URL** = `http://localhost:5100` (ต้องตรงกับที่เปิดในเบราว์เซอร์)  
3. เปิด **Treat HTTP localhost as HTTPS for testing** (ถ้ามี)  
4. ใส่ App ID ชุด dev ใน `.env` และ `ONESIGNAL_APP_ID` / REST key ใน `workers/notifications/.dev.vars`  
5. Production ยังใช้ App ID เดิมบน `helm.zkcnt.com`

รายละเอียด: [OneSignal — test on localhost](https://documentation.onesignal.com/docs/web-sdk-setup#localhost-testing)

---

## แก้ปัญหาที่พบบ่อย

### Login แล้ว redirect กลับ login

- ตรวจว่า `NUXT_PUBLIC_APP_URL` ตรงกับ URL ที่เปิดจริง
- ตรวจ **Redirect URLs** ใน Supabase Auth settings

### สมัครสมาชิกแล้วได้ `Database error saving new user`

ข้อความนี้มาจาก **Supabase Auth** — มักหมายความว่า trigger บน `auth.users` (สร้าง `profiles` / workspace) ล้ม  
Auth จะไม่บอก SQL error จริง ต้องไปดู log เอง:

1. **Dashboard → Logs → Postgres Logs** — มองหา `handle_new_user` / `permission denied` / `relation ... does not exist`
2. **Dashboard → Logs → Auth Logs** — จะเห็น `unexpected_failure` คู่กับ request signup
3. **SQL Editor** รันเพื่อเช็ค trigger:

```sql
-- ดู trigger บน auth.users
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'auth.users'::regclass;

-- ดู function
select proname, prosecdef, proconfig
from pg_proc
where proname in ('handle_new_user', 'handle_new_profile');
```

แก้ด้วย migration `003_fix_signup_triggers.sql` แล้วรัน:

```bash
task supabase:push
```

### ไม่เห็นข้อมูล / permission denied

- ตรวจว่ารัน migration `002_rls_policies.sql` แล้ว
- ตรวจว่า user เป็นสมาชิก workspace (`workspace_members`)
- ตรวจว่าอยู่ **workspace ที่ถูกต้อง** (สลับจากเมนู Workspace ใน sidebar)

### แยกทีมด้วย Workspace (แนะนำ)

Helm ออกแบบให้ **หนึ่งทีม = หนึ่ง workspace**

- ลูกค้า (`customers`), โปรเจกต์, ป้ายกำกับ และสมาชิกทีม แยกตาม `workspace_id`
- สมาชิกเห็นข้อมูลเฉพาะ workspace ที่ถูกเชิญเข้า และ workspace ที่เลือกอยู่
- สร้าง workspace ใหม่จาก sidebar → **Workspace → สร้าง workspace** แล้วเชิญเฉพาะคนในทีมนั้น (หน้า Team)
- **เชิญผ่านลิงก์:** หน้า Team (แอดมิน) → สร้างลิงก์เปิดหรือผูกอีเมล พร้อมวันหมดอายุ → แชร์ `/invite/{token}`
- **Audit log:** แอดมินดูประวัติโปรเจกต์/ลูกค้า/สมาชิก/invite ได้ที่เมนู Audit

**อย่าเชิญทุกทีมเข้า workspace เดียว** — จะทำให้ลูกค้าและโปรเจกต์ปนกัน

#### ข้อมูลเดิมที่ปนใน workspace เดียวแล้ว

ยังไม่มี wizard ย้ายในแอป — ย้ายด้วยมือ/SQL:

1. สร้าง workspace ใหม่ต่อทีมจาก UI
2. เชิญเฉพาะสมาชิกทีมนั้นเข้า workspace ใหม่
3. อัปเดต `workspace_id` ของแถวที่ต้องย้าย เช่น:

```sql
-- ตัวอย่าง: ย้ายลูกค้าและโปรเจกต์ที่เกี่ยวข้องไป workspace ใหม่
-- แทนที่ :old_ws, :new_ws, และเงื่อนไขให้ตรงข้อมูลจริง

update customers
set workspace_id = :new_ws
where workspace_id = :old_ws
  and id in (/* customer ids ของทีมนี้ */);

update projects
set workspace_id = :new_ws
where workspace_id = :old_ws
  and customer_id in (/* customer ids ที่ย้ายแล้ว */);

-- labels ที่ workspace ใหม่จะมีชุด default จาก create_workspace อยู่แล้ว
-- งาน (tasks) ตาม projects ที่ย้าย — ไม่ต้องเปลี่ยน workspace_id โดยตรง
```

4. (ทางเลือก) ลบสมาชิกออกจาก workspace เก่าหลังย้ายเสร็จ

อย่าลืมรัน migration `013_active_workspace_invites_audit.sql` ก่อนใช้ฟีเจอร์ workspace / invite / audit:

```bash
task supabase:push
```

### อัปโหลดไฟล์ไม่ได้

- ตรวจว่าสร้าง bucket `attachments` แล้ว
- ตรวจว่าสร้าง bucket `avatars` แล้ว (รูปโปรไฟล์ตอนสมัคร)
- ตรวจ Storage policies ใน Supabase

### Build ล้มบน Cloudflare

- ตั้ง env variables ครบ (`SUPABASE_URL`, `SUPABASE_KEY` เป็น publishable key)
- อย่าใส่ secret key (`sb_secret_...`) ใน Cloudflare Pages public vars
- เปิด **Node.js compatibility** ใน Cloudflare Pages settings ถ้าจำเป็น

### แจ้งเตือนและ Web Push

- Task events สร้างแถวใน `notifications` ผ่าน migration `016` / `017` (ดู [`supabase/migrations/`](supabase/migrations/))
- ทดสอบ local: ดูหัวข้อ **[ทดสอบบน localhost](#ทดสอบบน-localhost)** — สรุปคือ `task dev` หรือ `task dev:local` **คู่กับ** `task notifications:dev`
- OneSignal: `NUXT_PUBLIC_ONESIGNAL_APP_ID` ใน `.env` — **ต้องเป็น App ID ที่ Site URL ตรงกับ origin ที่เปิด** (localhost ต้องใช้แอป OneSignal แยกจาก production)
- ข้อความ `Can only be used on: https://…` = ใช้ App ID ของ production บน localhost → ดูหัวข้อทดสอบบน localhost ด้านบน
- PWA: บน iOS แนะนำ Add to Home Screen สำหรับ push

---

## License

Private — ใช้ภายในทีม
