import type { TaskPriority } from "@/types";

export const priorityStyles: Record<
  TaskPriority,
  { label: string; card: string; badge: string; calendar: string }
> = {
  low: {
    label: "Baja",
    card: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800",
    calendar: "#059669",
  },
  medium: {
    label: "Media",
    card: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    calendar: "#d97706",
  },
  high: {
    label: "Alta",
    card: "border-orange-300 bg-orange-50",
    badge: "bg-orange-100 text-orange-900",
    calendar: "#ea580c",
  },
  critical: {
    label: "Crítica",
    card: "border-red-300 bg-red-50",
    badge: "bg-red-600 text-white",
    calendar: "#dc2626",
  },
};
