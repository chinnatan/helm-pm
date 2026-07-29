import type { Env } from "./env";
import { runCapacityCron } from "./capacity";
import { handleNotificationWebhook, parseWebhookBody, verifyWebhookAuth } from "./webhook";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhooks/notifications" && request.method === "POST") {
      if (!verifyWebhookAuth(request, env.WEBHOOK_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("Bad JSON", { status: 400 });
      }
      const record = parseWebhookBody(body);
      if (!record) {
        return new Response("Invalid payload", { status: 400 });
      }
      return handleNotificationWebhook(env, record);
    }

    if (url.pathname === "/cron/capacity" && request.method === "POST") {
      if (env.CRON_SECRET) {
        const auth = request.headers.get("Authorization");
        if (auth !== `Bearer ${env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      const result = await runCapacityCron(env);
      return Response.json(result);
    }

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCapacityCron(env));
  },
};
