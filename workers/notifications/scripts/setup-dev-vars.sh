#!/usr/bin/env bash
# สร้าง .dev.vars สำหรับ Wrangler local จาก .env รากโปรเจกต์ (และ workers/notifications/.env ถ้ามี)
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
OUT="$DIR/.dev.vars"
ROOT_ENV="$ROOT/.env"
LEGACY_ENV="$DIR/.env"

read_env_var() {
  local file="$1" key="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true
  fi
}

if [[ -f "$OUT" ]]; then
  echo "✓ $OUT มีอยู่แล้ว — ไม่ทับ (ลบไฟล์ก่อนถ้าต้องการสร้างใหม่)"
  exec "$DIR/scripts/print-webhook-setup.sh"
fi

WEBHOOK_SECRET="$(openssl rand -hex 24)"

SUPABASE_URL="$(read_env_var "$ROOT_ENV" SUPABASE_URL)"
if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="$(read_env_var "$LEGACY_ENV" SUPABASE_URL)"
fi

SUPABASE_SERVICE_ROLE_KEY="$(read_env_var "$ROOT_ENV" SUPABASE_SERVICE_KEY)"
if [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  SUPABASE_SERVICE_ROLE_KEY="$(read_env_var "$LEGACY_ENV" SUPABASE_SERVICE_ROLE_KEY)"
fi

ONESIGNAL_APP_ID="$(read_env_var "$ROOT_ENV" NUXT_PUBLIC_ONESIGNAL_APP_ID)"
if [[ -z "$ONESIGNAL_APP_ID" ]]; then
  ONESIGNAL_APP_ID="$(read_env_var "$LEGACY_ENV" ONESIGNAL_APP_ID)"
fi

ONESIGNAL_REST_API_KEY="$(read_env_var "$LEGACY_ENV" ONESIGNAL_REST_API_KEY)"

NUXT_PUBLIC_APP_URL="$(read_env_var "$ROOT_ENV" NUXT_PUBLIC_APP_URL)"
if [[ -z "$NUXT_PUBLIC_APP_URL" ]]; then
  NUXT_PUBLIC_APP_URL="$(read_env_var "$LEGACY_ENV" NUXT_PUBLIC_APP_URL)"
fi
NUXT_PUBLIC_APP_URL="${NUXT_PUBLIC_APP_URL:-http://localhost:5100}"

CRON_SECRET="$(read_env_var "$LEGACY_ENV" CRON_SECRET)"

cat >"$OUT" <<EOF
# สร้างโดย task notifications:setup — อย่า commit
WEBHOOK_SECRET=$WEBHOOK_SECRET

ONESIGNAL_APP_ID=$ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY=$ONESIGNAL_REST_API_KEY

SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

NUXT_PUBLIC_APP_URL=$NUXT_PUBLIC_APP_URL
EOF

if [[ -n "$CRON_SECRET" ]]; then
  echo "CRON_SECRET=$CRON_SECRET" >>"$OUT"
fi

chmod 600 "$OUT" 2>/dev/null || true

echo "✓ สร้าง $OUT แล้ว"
echo "  WEBHOOK_SECRET ถูกสุ่มใหม่ (ไม่ใช่ค่าจาก Supabase — คุณต้องใส่ใน Webhook เอง)"
echo ""

missing=0
for key in ONESIGNAL_APP_ID ONESIGNAL_REST_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  val="$(grep -E "^${key}=" "$OUT" | cut -d= -f2- || true)"
  if [[ -z "$val" ]]; then
    echo "⚠ ยังไม่มี $key — เติมใน $OUT หรือใน $ROOT_ENV"
    missing=1
  fi
done

if [[ "$missing" -eq 0 ]]; then
  echo "✓ ค่าหลักครบ"
fi

echo ""
exec "$DIR/scripts/print-webhook-setup.sh"
