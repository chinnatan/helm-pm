import type { Env } from "./env";

export async function sendWebPush(
  env: Env,
  input: {
    externalUserId: string;
    title: string;
    body: string;
    url: string | null;
  },
): Promise<{ ok: true; id?: string } | { error: string }> {
  const payload: Record<string, unknown> = {
    app_id: env.ONESIGNAL_APP_ID,
    include_external_user_ids: [input.externalUserId],
    target_channel: "push",
    headings: { en: input.title },
    contents: { en: input.body },
  };

  if (input.url) {
    payload.url = input.url;
  }

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${env.ONESIGNAL_REST_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  const data = (await res.json()) as { id?: string; errors?: string[] };
  if (data.errors?.length) {
    return { error: data.errors.join("; ") };
  }

  return { ok: true, id: data.id };
}
