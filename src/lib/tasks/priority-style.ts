import type { TaskPriority } from "@/types";

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
