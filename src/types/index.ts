export type UserRole = "admin" | "manager" | "collaborator";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface SessionUser {
  id: string;
  companyId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface Task {
  id: string;
  company_id: string;
  created_by: string;
  responsible_id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  color: string | null;
  is_pinned: boolean;
  created_at: string;
  responsible?: { full_name: string; email: string } | null;
}
