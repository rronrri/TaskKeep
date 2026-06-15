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
    card: "border-sky-200 bg-sky-50",
    badge: "bg-sky-100 text-sky-800",
    calendar: "#0284c7",
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
