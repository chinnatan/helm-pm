#!/usr/bin/env bash
# แสดงค่าที่ต้องใส่ใน Supabase Studio → Database → Webhooks
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEV_VARS="$DIR/.dev.vars"

if [[ ! -f "$DEV_VARS" ]]; then
  echo "ยังไม่มี $DEV_VARS"
  echo "รันก่อน: task notifications:setup"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$DEV_VARS"
set +a

if [[ -z "${WEBHOOK_SECRET:-}" ]]; then
  echo "WEBHOOK_SECRET ว่างใน .dev.vars — รัน: task notifications:setup"
  exit 1
fi

PORT="${WRANGLER_PORT:-8787}"
WEBHOOK_URL="http://host.docker.internal:${PORT}/webhooks/notifications"

echo ""
echo "=== ตั้ง Database Webhook (Supabase local หรือ cloud) ==="
echo ""
echo "Table:     notifications"
echo "Events:    Insert"
echo "URL:       $WEBHOOK_URL"
echo "           (ถ้าใช้ worker บน Cloudflare แทน local ให้ใช้ https://<worker>/webhooks/notifications)"
echo ""
echo "HTTP Headers (เพิ่มหนึ่งแถว):"
echo "  Name:  Authorization"
echo "  Value: Bearer $WEBHOOK_SECRET"
echo ""
echo "หรือใช้ header แทนได้:"
echo "  Name:  x-webhook-secret"
echo "  Value: $WEBHOOK_SECRET"
echo ""
echo "Studio local มักอยู่ที่: http://127.0.0.1:54323"
echo "Worker local: task notifications:dev (พอร์ต $PORT)"
echo ""
