export type TaskStatus =
  | "inbox"
  | "todo"
  | "in_progress"
  | "testing"
  | "done"
  | "cancelled";
export type TaskType = "feature" | "bug" | "infra" | "customer-request";
export type RolloutStatus =
  | "planned"
  | "developing"
  | "testing"
  | "production"
  | "cancelled";
export type CommitmentTargetStatus = "developing" | "testing" | "production";
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
export const JOB_ROLE_VALUES: JobRole[] = [
  "developer",
  "tester",
  "designer",
  "pm",
  "other",
];

export const TASK_STATUS_VALUES: TaskStatus[] = [
  "inbox",
  "todo",
  "in_progress",
  "testing",
  "done",
  "cancelled",
];

export const TASK_TYPE_VALUES: TaskType[] = ["feature", "bug", "infra", "customer-request"];

export const ROLLOUT_STATUS_VALUES: RolloutStatus[] = [
  "planned",
  "developing",
  "testing",
  "production",
  "cancelled",
];

export const COMMITMENT_TARGET_STATUS_VALUES: CommitmentTargetStatus[] = [
  "developing",
  "testing",
  "production",
];

/** Statuses that mean the task is no longer active work */
export const TASK_CLOSED_STATUSES: TaskStatus[] = ["done", "cancelled"];

export function isTaskClosed(status: TaskStatus) {
  return TASK_CLOSED_STATUSES.includes(status);
}

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

/** Default effort (hours) when task.estimate_hours is null */
export const PRIORITY_DEFAULT_HOURS: Record<TaskPriority, number> = {
  low: 2,
  medium: 4,
  high: 6,
  urgent: 8,
};

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
  max_uses: number;
  uses_count: number;
}

export interface InvitePreview {
  status: InvitePreviewStatus;
  workspace_id?: string;
  workspace_name?: string;
  invite_type?: InviteType;
  email?: string | null;
  role?: MemberRole;
  expires_at?: string;
  max_uses?: number;
  uses_count?: number;
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

export interface Feature {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface Rollout {
  id: string;
  workspace_id: string;
  customer_id: string;
  feature_id: string;
  status: RolloutStatus;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, "id" | "name" | "company"> | null;
  features?: Pick<Feature, "id" | "name" | "color"> | null;
  commitments?: Commitment[];
}

export interface Commitment {
  id: string;
  rollout_id: string;
  /** วันแรกของเดือน (YYYY-MM-01) */
  month: string;
  target_status: CommitmentTargetStatus;
  created_at: string;
  commitment_reschedules?: CommitmentReschedule[];
}

export interface CommitmentReschedule {
  id: string;
  commitment_id: string;
  from_month: string;
  to_month: string;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface TaskTemplate {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimate_hours: number | null;
  label_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  feature_id: string | null;
  task_type: TaskType;
  assignee_id: string | null;
  tester_id: string | null;
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
  features?: Pick<Feature, "id" | "name" | "color"> | null;
  customers?: Pick<Customer, "id" | "name"> | null;
  subtasks?: Subtask[];
  task_labels?: { labels: Label }[];
  user_task_preferences?: UserTaskPreference[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  sort_order: number;
  status: TaskStatus;
  assignee_id: string | null;
  tester_id: string | null;
  estimate_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  profiles?: Profile;
  tester?: Profile;
  subtask_labels?: { labels: Label }[];
}

export interface Comment {
  id: string;
  task_id: string;
  subtask_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface ActivityLog {
  id: string;
  task_id: string;
  subtask_id: string | null;
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
  subtask_id: string | null;
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

export const FEATURE_COLORS = [
  "#0B6E7A",
  "#085560",
  "#0e7490",
  "#0891b2",
  "#2563eb",
  "#1e3a5f",
  "#16a34a",
  "#ea580c",
];
