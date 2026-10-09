-- ข้อมูลจำลองใน schema เก่า (≤030) ให้ใกล้ production: ทุก status เก่า, subtask, dependency, template, notification ฯลฯ
do $$
declare
  w uuid; owner uuid; member uuid;
  c uuid; p uuid; ms uuid; t1 uuid; t2 uuid; t3 uuid; t4 uuid; n uuid; l uuid; m uuid; s uuid;
begin
  select id into owner from profiles where email='owner@example.com';
  select id into member from profiles where email='member@example.com';
  select workspace_id into w from workspace_members where user_id=owner limit 1;
  insert into workspace_members(workspace_id,user_id,role) values (w,member,'member') on conflict do nothing;

  insert into customers(workspace_id,name,company) values (w,'SJC','SJC Co.') returning id into c;
  insert into projects(workspace_id,name,customer_id,owner_id) values (w,'Vinai QMS',c,owner) returning id into p;
  insert into milestones(project_id,title,date,start_date,due_date,status,phase) values (p,'ต.ค.','2026-10-31','2026-10-01','2026-10-31','planned','development') returning id into ms;
  insert into labels(workspace_id,name,color) values (w,'Bug','#ef4444') on conflict do nothing;
  select id into l from labels where workspace_id=w and name='Bug';

  insert into tasks(project_id,title,status,priority,assignee_id,tester_id,milestone_id,customer_id,phase,due_date,created_by) values (p,'Backlog item','backlog','low',owner,null,ms,c,'requirements','2026-10-20',owner) returning id into t1;
  insert into tasks(project_id,title,status,priority,assignee_id,tester_id,milestone_id,customer_id,phase,created_by) values (p,'ใน progress','in_progress','high',owner,member,ms,c,'development',owner) returning id into t2;
  insert into tasks(project_id,title,status,priority,assignee_id,customer_id,phase,created_by) values (p,'พร้อมเทส','ready_for_test','medium',member,c,'testing',owner) returning id into t3;
  insert into tasks(project_id,title,status,priority,assignee_id,created_by) values (p,'Release แล้ว','release','urgent',owner,owner) returning id into t4;
  insert into tasks(project_id,title,status,priority) values (p,'ยกเลิก','cancelled','low'),(p,'เสร็จ','done','medium');

  insert into subtasks(task_id,title,status,assignee_id,completed) values (t2,'sub A','in_progress',member,false) returning id into s;
  insert into subtasks(task_id,title,status,completed) values (t2,'sub B','release',true),(t3,'sub C','ready_for_test',false);
  insert into task_labels(task_id,label_id) values (t2,l);
  insert into task_dependencies(task_id,depends_on_task_id) values (t3,t2);
  insert into comments(task_id,user_id,content) values (t2,owner,'คอมเมนต์');
  insert into attachments(task_id,uploaded_by,file_url,filename) values (t2,owner,'http://x/y.png','y.png');
  insert into user_task_preferences(user_id,task_id,is_pinned,sort_order) values (owner,t2,true,0);
  update tasks set status='testing', priority='urgent' where id=t2;      -- trigger: activity_log + notifications
  insert into notifications(user_id,task_id,type,message) values (owner,null,'project_overdue:x:2026-10-12:'||owner,'overdue'),(member,t2,'task_assigned','assigned');
  insert into notification_deliveries(notification_id,channel,status) select id,'web_push','sent' from notifications limit 1;

  insert into meetings(customer_id,title,met_at) values (c,'ประชุม kickoff',now()) returning id into m;
  insert into requirements(customer_id,meeting_id,title,status,task_id) values (c,m,'ข้อกำหนด 1','in_progress',t2);
  insert into member_month_capacities(workspace_id,user_id,month_start,hours) values (w,owner,'2026-10-01',120);
  insert into workspace_month_calendars(workspace_id,month_start,working_days) values (w,'2026-10-01',22);
  insert into task_templates(workspace_id,created_by,title,status,phase,priority) values
    (w,owner,'tpl backlog','backlog','requirements','low'),
    (w,owner,'tpl release','release','deployment','high'),
    (w,owner,'tpl rft','ready_for_test','testing','medium'),
    (w,owner,'tpl todo','todo',null,'medium');
end $$;
select 'tasks', count(*) from tasks union all select 'subtasks', count(*) from subtasks union all select 'notifications', count(*) from notifications union all select 'activity_log', count(*) from activity_log union all select 'projects', count(*) from projects union all select 'templates', count(*) from task_templates;
