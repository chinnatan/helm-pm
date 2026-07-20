-- =============================================================================
-- Helm PM: Migration 005 — Realtime + grants
-- =============================================================================
-- อาการ: invalid column for filter user_id / project_id
-- สาเหตุ: Realtime ตรวจว่า role authenticated มี SELECT บนคอลัมน์ที่ใช้ filter
-- และ replica identity แบบ default จำกัดการ filter
-- แก้: GRANT สิทธิ์ชัดเจน + REPLICA IDENTITY FULL ให้ filter ได้ (ถ้าใช้ในอนาคต)

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ให้ Realtime filter ได้บนคอลัมน์ที่ไม่ใช่ PK
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
