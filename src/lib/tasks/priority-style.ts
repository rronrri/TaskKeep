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
// marca) y completada (verde). Es un stamp de solo lectura (mismo patrón que
// ya usa el tablero de colaborador/a) al lado del select, no un color en el
// propio <select> -el navegador no siempre respeta bien el estilo de fondo
// de un control nativo, así que no era confiable.
export const statusStamps: Record<TaskStatus, string> = {
  pending: "stamp stamp-medium",
  in_progress: "stamp stamp-primary",
  completed: "stamp stamp-success",
};
