import type { Env } from "./env";
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

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
};
