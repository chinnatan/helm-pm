import type { Env, NotificationRow, ProfileRow } from "./env";
import { sendWebPush } from "./onesignal";
import { supabaseGet, supabasePatch, supabasePost } from "./supabase";

function prefKeyForType(type: string): string {
  if (type.startsWith("capacity_overload") || type.startsWith("project_overdue")) {
    return "capacity";
  }
  return type.split(":")[0] ?? type;
}

export function shouldSendPush(
  prefs: Record<string, boolean> | null | undefined,
  type: string,
): boolean {
  if (prefs?.web_push_enabled === false) return false;
  const key = prefKeyForType(type);
  if (prefs && key in prefs && prefs[key] === false) return false;
  return true;
}

async function taskLink(
  env: Env,
  notification: NotificationRow,
): Promise<string | null> {
  const meta = notification.metadata ?? {};
  let projectId = meta.project_id as string | undefined;

  if (!projectId && notification.task_id) {
    const { data } = await supabaseGet<{ project_id: string }[]>(
      env,
      `tasks?id=eq.${notification.task_id}&select=project_id`,
    );
    projectId = data?.[0]?.project_id;
  }

  if (!projectId) return null;
  const base = env.NUXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (notification.task_id) {
    return `${base}/projects/${projectId}/board?task=${notification.task_id}`;
  }
  return `${base}/projects/${projectId}`;
}

export async function handleNotificationWebhook(
  env: Env,
  record: NotificationRow,
): Promise<Response> {
  const { data: profiles } = await supabaseGet<ProfileRow[]>(
    env,
    `profiles?id=eq.${record.user_id}&select=id,notification_preferences`,
  );
  const profile = profiles?.[0];

  if (!shouldSendPush(profile?.notification_preferences, record.type)) {
    await upsertDelivery(env, record.id, "skipped", "prefs_disabled");
    return new Response(JSON.stringify({ ok: true, skipped: "prefs_disabled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const link = await taskLink(env, record);
  const title = "Helm PM";
  const body = record.message;

  const sent = await sendWebPush(env, {
    externalUserId: record.user_id,
    title,
    body,
    url: link,
  });

  if ("error" in sent) {
    const isNoSubscribers =
      sent.error.includes("not subscribed") ||
      sent.error.includes("All included players are not subscribed");
    await upsertDelivery(
      env,
      record.id,
      isNoSubscribers ? "skipped" : "failed",
      sent.error,
    );
    return new Response(JSON.stringify({ ok: isNoSubscribers, error: sent.error }), {
      status: isNoSubscribers ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  await upsertDelivery(env, record.id, "sent", null);
  return new Response(JSON.stringify({ ok: true }), {
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
