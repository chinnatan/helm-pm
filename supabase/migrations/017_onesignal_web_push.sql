-- Helm PM: OneSignal web push — migrate prefs, remove Discord columns if present

-- Migrate discord_enabled → web_push_enabled
UPDATE profiles
SET notification_preferences =
  (notification_preferences - 'discord_enabled')
  || jsonb_build_object(
    'web_push_enabled',
    CASE
      WHEN notification_preferences ? 'web_push_enabled' THEN
        (notification_preferences->>'web_push_enabled')::boolean
      WHEN notification_preferences->>'discord_enabled' = 'false' THEN false
      ELSE true
    END
  )
WHERE notification_preferences ? 'discord_enabled';

UPDATE profiles
SET notification_preferences =
  notification_preferences || '{"web_push_enabled": true}'::jsonb
WHERE NOT (notification_preferences ? 'web_push_enabled');

ALTER TABLE profiles
  ALTER COLUMN notification_preferences SET DEFAULT '{
    "web_push_enabled": true,
    "mention": true,
    "task_assigned": true,
    "task_tester_assigned": true,
    "task_status_changed": true,
    "task_due_date_changed": true,
    "task_priority_changed": true,
    "capacity": true
  }'::jsonb;

DROP INDEX IF EXISTS profiles_discord_user_id_key;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS discord_user_id,
  DROP COLUMN IF EXISTS discord_linked_at;

NOTIFY pgrst, 'reload schema';
