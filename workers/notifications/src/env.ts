export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ONESIGNAL_APP_ID: string;
  ONESIGNAL_REST_API_KEY: string;
  WEBHOOK_SECRET: string;
  NUXT_PUBLIC_APP_URL: string;
  CRON_SECRET?: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  notification_preferences: Record<string, boolean> | null;
}
