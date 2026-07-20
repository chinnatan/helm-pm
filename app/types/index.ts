export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MemberRole = "admin" | "manager" | "member" | "viewer";
export type PlannerTab = "today" | "week" | "inbox" | "focus";

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

export interface Task {
  id: string;
  project_id: string;
  assignee_id: string | null;
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

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  date: string;
  created_at: string;
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

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "neutral" },
  { value: "medium", label: "Medium", color: "info" },
  { value: "high", label: "High", color: "warning" },
  { value: "urgent", label: "Urgent", color: "error" },
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
