export type UserRole = "admin" | "manager" | "collaborator";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type ReminderMode = "none" | "daily" | "monthly" | "deadline";

export interface ReminderSettings {
  deadline_offsets?: number[];
  recurring_time?: string;
  monthly_day?: number;
  timezone_offset_minutes?: number;
}

export interface SessionUser {
  id: string;
  companyId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface Task {
  id: string;
  company_id: string;
  created_by: string;
  responsible_id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_pinned: boolean;
  reminders_enabled: boolean;
  reminder_mode: ReminderMode;
  next_reminder_at: string | null;
  reminder_settings: ReminderSettings;
  folder_id: string | null;
  created_at: string;
  responsible?: { full_name: string; email: string } | null;
}

export interface TaskFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
