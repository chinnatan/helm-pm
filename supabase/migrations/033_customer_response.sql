-- Helm PM: Migration 033 — Customer response (ก้อน C)
-- คำตอบของทีมต่อคำขอลูกค้า เก็บบน tasks (Task type customer-request) ตามที่ตกลงว่า Issue = Task
ALTER TABLE tasks
  ADD COLUMN response_status TEXT
    CHECK (response_status IN ('accepted', 'deferred', 'rejected')),
  ADD COLUMN response_text TEXT,
  ADD COLUMN customer_visible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN requested_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD CONSTRAINT tasks_response_only_for_requests
    CHECK ((response_status IS NULL AND response_text IS NULL) OR task_type = 'customer-request');

COMMENT ON COLUMN tasks.response_status IS 'null = ยังไม่ตอบ; ใช้ได้เฉพาะ task_type customer-request';
COMMENT ON COLUMN tasks.customer_visible IS 'false = รายการภายใน ไม่แสดงใน Issue Log ฉบับลูกค้า/ลิงก์แชร์';
COMMENT ON COLUMN tasks.requested_on IS 'วันที่รับคำขอ ใช้เลือกช่วงของ Issue Log';

CREATE INDEX tasks_customer_requests_idx ON tasks(customer_id, requested_on) WHERE task_type = 'customer-request';

CREATE OR REPLACE FUNCTION public.log_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'status', OLD.status, NEW.status);
    END IF;
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;
    IF OLD.tester_id IS DISTINCT FROM NEW.tester_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'tester_id', OLD.tester_id::text, NEW.tester_id::text);
    END IF;
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'customer_id', OLD.customer_id::text, NEW.customer_id::text);
    END IF;
    IF OLD.feature_id IS DISTINCT FROM NEW.feature_id THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'feature_id', OLD.feature_id::text, NEW.feature_id::text);
    END IF;
    IF OLD.response_status IS DISTINCT FROM NEW.response_status THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'response_status', OLD.response_status, NEW.response_status);
    END IF;
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'due_date', OLD.due_date::text, NEW.due_date::text);
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'updated', 'priority', OLD.priority, NEW.priority);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (task_id, user_id, action)
    VALUES (NEW.id, auth.uid(), 'created');
  END IF;
  RETURN NEW;
END;
$function$;
