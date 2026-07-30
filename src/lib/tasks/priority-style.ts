import type { TaskPriority, TaskStatus } from "@/types";

export const priorityStyles: Record<
  TaskPriority,
  { label: string; card: string; badge: string; calendar: string }
> = {
  low: {
    label: "Baja",
    card: "card-priority-low",
    badge: "stamp stamp-low",
    calendar: "#4a7058",
  },
  medium: {
    label: "Media",
    card: "card-priority-medium",
    badge: "stamp stamp-medium",
    calendar: "#9a7b24",
  },
  high: {
    label: "Alta",
    card: "card-priority-high",
    badge: "stamp stamp-high",
    calendar: "#b4551d",
  },
  critical: {
    label: "Crítica",
    card: "card-priority-critical",
    badge: "stamp stamp-critical",
    calendar: "#a5311f",
  },
};

// Semáforo del estado de una tarea: pendiente (ámbar), en curso (azul de la
// marca) y completada (verde), reusando los mismos tokens de color que ya
// existen para prioridad/stamps en globals.css.
export const statusSelectStyles: Record<TaskStatus, string> = {
  pending: "!border-[var(--prio-medium)] !bg-[var(--prio-medium-wash)] !text-[var(--prio-medium)]",
  in_progress: "!border-[var(--primary)] !bg-[var(--primary-wash)] !text-[var(--primary)]",
  completed: "!border-[var(--prio-low)] !bg-[var(--prio-low-wash)] !text-[var(--prio-low)]",
};
