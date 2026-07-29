# Helm PM — Notifications Worker

Cloudflare Worker สำหรับ:

- **Database webhook** — `POST /webhooks/notifications` → OneSignal Web Push
- **Cron** — capacity / overdue alerts (`0 * * * *`)

## ทดสอบบนเครื่อง (แนะนำ — ทำตามลำดับ)

### 1) สร้างไฟล์ env ของ Worker

Wrangler ใช้ **`workers/notifications/.dev.vars`** (ไม่ใช่ `.env` และไม่มี `SUPABASE_WEBHOOK_SECRET` จาก Supabase)

จาก **repo root**:

```bash
task notifications:setup
```

สคริปต์จะ:

- สุ่ม **`WEBHOOK_SECRET`** ให้ (คุณเป็นคนกำหนด — Supabase ไม่แจกค่านี้)
- คัดลอก `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` จาก `.env` รากโปรเจกต์ (ถ้ามี)
- คัดลอก OneSignal จาก `workers/notifications/.env` ถ้าคุณเคยใส่ไว้ที่นั่น
- พิมพ์ค่าที่ต้องไปวางใน **Supabase Studio → Database → Webhooks**

ดูซ้ำได้ทุกเมื่อ:

```bash
task notifications:webhook-hint
```

### 2) ตั้ง Database Webhook ใน Supabase

เปิด Studio:

- **Local:** `task supabase:start` แล้วไป `http://127.0.0.1:54323`
- **Cloud:** Dashboard โปรเจกต์ของคุณ

**Database → Webhooks → Create a new hook**

| ช่อง | ค่า |
|------|-----|
| Table | `notifications` |
| Events | **Insert** |
| URL | `http://host.docker.internal:8787/webhooks/notifications` (local + Docker) |
| HTTP Header | `Authorization` = `Bearer <WEBHOOK_SECRET จาก task notifications:webhook-hint>` |

> บน Linux ถ้า `host.docker.internal` ไม่ได้ ให้ใช้ IP เครื่อง host แทน

### 3) รัน Worker

```bash
task notifications:dev
```

ทดสอบ: `curl http://localhost:8787/health` → `ok`

### 4) รันแอป + ทดสอบ push

```bash
task dev
```

เปิดโปรไฟล์ → Enable notifications → ให้คนอื่น assign งาน → ควรมีแถวใน `notifications` แล้ว Worker ส่ง OneSignal

---

## ติดตั้ง

```bash
cd workers/notifications
bun install
```

## Deploy (production)

```bash
wrangler secret put ONESIGNAL_APP_ID
wrangler secret put ONESIGNAL_REST_API_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_URL
wrangler secret put WEBHOOK_SECRET
wrangler secret put NUXT_PUBLIC_APP_URL
```

Webhook URL บน cloud: `https://<worker-name>.<account>.workers.dev/webhooks/notifications`

`ONESIGNAL_APP_ID` ต้องตรงกับ `NUXT_PUBLIC_ONESIGNAL_APP_ID` ใน Nuxt

## OneSignal (แอป Nuxt)

1. Web app ใน OneSignal Dashboard — **Site URL ต้องตรง origin ที่รันจริง** (ดูด้านล่าง)
2. `NUXT_PUBLIC_ONESIGNAL_APP_ID` ใน `.env` รากโปรเจกต์
3. [`public/OneSignalSDKWorker.js`](../../public/OneSignalSDKWorker.js)

**Production** (`https://helm.zkcnt.com` หรือโดเมนจริง): ใช้ App ID ที่ตั้ง Site URL เป็นโดเมนนั้น

**Localhost** (`http://localhost:5100`): OneSignal **ไม่อนุญาต** ใช้ App ID เดียวกับ production — สร้างแอป dev แยก, Site URL = `http://localhost:5100`, ใส่ App ID + REST API key ใน `.env` / `.dev.vars` ชุด dev (แล้วรัน `task notifications:setup` อีกครั้งถ้าต้อง sync)

`NUXT_PUBLIC_APP_URL` ใน `.env` ไม่แทน Site URL ใน OneSignal Dashboard

External User ID = Supabase `user.id` (หลัง login)

## ไฟล์ตัวอย่าง

- [`.dev.vars.example`](.dev.vars.example) — รายการตัวแปรทั้งหมด

`GET /health` → `ok`
