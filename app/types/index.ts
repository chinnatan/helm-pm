export type TaskStatus =
  | "todo"
  | "in_progress"
  | "ready_for_test"
  | "testing"
  | "done"
  | "release"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MemberRole = "admin" | "manager" | "member" | "viewer";
export type JobRole = "developer" | "tester" | "designer" | "pm" | "other";
export type PlannerTab = "today" | "week" | "inbox" | "focus";
export type CustomerStatus = "active" | "archived";
export type TaskCardDensity = "compact" | "standard" | "detailed";

export const TASK_CARD_DENSITY_VALUES: TaskCardDensity[] = [
  "compact",
  "standard",
  "detailed",
];
export type RequirementStatus = "open" | "in_progress" | "done" | "cancelled";

export const JOB_ROLE_VALUES: JobRole[] = [
  "developer",
  "tester",
  "designer",
  "pm",
  "other",
];

export const TASK_STATUS_VALUES: TaskStatus[] = [
  "todo",
  "in_progress",
  "ready_for_test",
  "testing",
  "done",
  "release",
  "cancelled",
];

/** Statuses that mean the task is no longer active work */
export const TASK_CLOSED_STATUSES: TaskStatus[] = ["done", "release", "cancelled"];

export function isTaskClosed(status: TaskStatus) {
  return TASK_CLOSED_STATUSES.includes(status);
}

export const REQUIREMENT_STATUS_VALUES: RequirementStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

export interface NotificationPreferences {
  web_push_enabled?: boolean;
  mention?: boolean;
  task_assigned?: boolean;
  task_tester_assigned?: boolean;
  task_status_changed?: boolean;
  task_due_date_changed?: boolean;
  task_priority_changed?: boolean;
  capacity?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  active_workspace_id?: string | null;
  task_card_density?: TaskCardDensity;
  notification_preferences?: NotificationPreferences | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMembership {
  membershipId: string;
  role: MemberRole;
  workspace: Workspace;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  job_role: JobRole | null;
  weekly_capacity_hours: number;
  created_at: string;
  profiles?: Profile;
}

export interface MemberMonthCapacity {
  id: string;
  workspace_id: string;
  user_id: string;
  month_start: string;
  hours: number;
  updated_at: string;
  created_at: string;
}

export interface WorkspaceMonthCalendar {
  id: string;
  workspace_id: string;
  month_start: string;
  working_days: number | null;
  holiday_days: number;
  meeting_days: number;
  company_event_days: number;
  leave_days: number;
  hours_per_day: number;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

/** Default effort (hours) when task.estimate_hours is null */
export const PRIORITY_DEFAULT_HOURS: Record<TaskPriority, number> = {
  low: 2,
  medium: 4,
  high: 6,
  urgent: 8,
};

export const DEFAULT_WEEKLY_CAPACITY_HOURS = 32;

export function effectiveTaskHours(task: {
  estimate_hours?: number | null;
  priority: TaskPriority;
}): number {
  if (task.estimate_hours != null && task.estimate_hours > 0) {
    return Number(task.estimate_hours);
  }
  return PRIORITY_DEFAULT_HOURS[task.priority] ?? PRIORITY_DEFAULT_HOURS.medium;
}

export type InviteType = "open" | "email";
export type InvitePreviewStatus =
  | "valid"
  | "expired"
  | "revoked"
  | "accepted"
  | "not_found";

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  token: string;
  invite_type: InviteType;
  email: string | null;
  role: MemberRole;
  job_role: JobRole | null;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
}

export interface InvitePreview {
  status: InvitePreviewStatus;
  workspace_id?: string;
  workspace_name?: string;
  invite_type?: InviteType;
  email?: string | null;
  role?: MemberRole;
  expires_at?: string;
}

export type AuditEntityType =
  | "workspace"
  | "member"
  | "invite"
  | "project"
  | "customer"
  | "capacity";

export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: AuditEntityType | string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: Pick<Profile, "id" | "email" | "full_name" | "avatar_url"> | null;
}

export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  company: string | null;
  contact_email: string | null;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  customer_id: string | null;
  owner_id: string | null;
  created_at: string;
  archived_at: string | null;
  customers?: Pick<Customer, "id" | "name"> | null;
  owner?: Pick<Profile, "id" | "email" | "full_name" | "avatar_url"> | null;
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  date: string;
  start_date: string;
  due_date: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  assignee_id: string | null;
  tester_id: string | null;
  milestone_id: string | null;
  customer_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  estimate_hours: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  tester?: Profile;
  milestones?: Pick<Milestone, "id" | "title" | "date" | "start_date" | "due_date"> | null;
  customers?: Pick<Customer, "id" | "name"> | null;
  projects?: Project;
  subtasks?: Subtask[];
  task_labels?: { labels: Label }[];
  user_task_preferences?: UserTaskPreference[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface ActivityLog {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface UserTaskPreference {
  user_id: string;
  task_id: string;
  is_pinned: boolean;
  scheduled_date: string | null;
  sort_order: number;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface Meeting {
  id: string;
  customer_id: string;
  title: string;
  met_at: string;
  summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Requirement {
  id: string;
  customer_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  status: RequirementStatus;
  task_id: string | null;
  created_at: string;
  updated_at: string;
  meetings?: Pick<Meeting, "id" | "title" | "met_at"> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface Attachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_url: string;
  filename: string;
  created_at: string;
}

export const TASK_PRIORITY_META: { value: TaskPriority; color: string }[] = [
  { value: "low", color: "neutral" },
  { value: "medium", color: "info" },
  { value: "high", color: "warning" },
  { value: "urgent", color: "error" },
];

export const PROJECT_COLORS = [
  "#0B6E7A",
  "#085560",
  "#0e7490",
  "#0891b2",
  "#2563eb",
  "#1e3a5f",
  "#16a34a",
  "#ea580c",
];
