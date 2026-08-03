import type { Env, NotificationRow } from "./env";
import { supabaseGet, supabasePatch, supabasePost } from "./supabase";

/**
 * Web push (OneSignal) is temporarily disabled — in-app notifications still work.
 * Keep this handler so Supabase webhooks do not 5xx while push is off.
 */
export async function handleNotificationWebhook(
  env: Env,
  record: NotificationRow,
): Promise<Response> {
  await upsertDelivery(env, record.id, "skipped", "web_push_disabled");
  return new Response(JSON.stringify({ ok: true, skipped: "web_push_disabled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function upsertDelivery(
  env: Env,
  notificationId: string,
  status: "sent" | "skipped" | "failed",
  error: string | null,
) {
  const row = {
    notification_id: notificationId,
    channel: "onesignal",
    status,
    error: error ? error.slice(0, 2000) : null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  };

  const existing = await supabaseGet<{ id: string }[]>(
    env,
    `notification_deliveries?notification_id=eq.${notificationId}&channel=eq.onesignal&select=id`,
  );

  if (existing.data?.[0]) {
    await supabasePatch(
      env,
      `notification_deliveries?id=eq.${existing.data[0].id}`,
      row,
    );
  } else {
    await supabasePost(env, "notification_deliveries", row);
  }
}

export function parseWebhookBody(body: unknown): NotificationRow | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const record = (b.record ?? b) as Record<string, unknown>;
  if (!record.id || !record.user_id || !record.message || !record.type) return null;
  return record as unknown as NotificationRow;
}

export function verifyWebhookAuth(request: Request, secret: string): boolean {
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-webhook-secret");
  return header === secret;
}
