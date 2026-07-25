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

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  job_role: JobRole | null;
  created_at: string;
  profiles?: Profile;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  archived_at: string | null;
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
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  assignee_id: string | null;
  tester_id: string | null;
  milestone_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  tester?: Profile;
  milestones?: Pick<Milestone, "id" | "title" | "date"> | null;
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

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
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
  "#1e3a5f",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#0891b2",
];
