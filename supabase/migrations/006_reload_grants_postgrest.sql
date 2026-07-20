-- =============================================================================
-- Helm PM: Migration 006 — reload PostgREST + ยืนยัน grants / execute
-- =============================================================================
-- อาการ: permission denied for table ... (hint: GRANT SELECT TO authenticated)
-- สิทธิ์ใน DB มีแล้ว แต่ PostgREST cache ยังเป็นของเก่า
-- แก้: GRANT ซ้ำ + GRANT EXECUTE บน helper + reload schema cache

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- helper functions ที่ RLS เรียก ต้องมีสิทธิ์ EXECUTE
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon;

-- บังคับ PostgREST โหลด schema / privileges ใหม่
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
