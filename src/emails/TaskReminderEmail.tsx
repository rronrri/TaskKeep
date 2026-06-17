import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { ReminderMode } from "@/types";

export function TaskReminderEmail({
  taskTitle,
  description,
  priority,
  deadline,
  days,
  leadMinutes,
  reminderMode,
  recipientName,
  responsibleName,
  managerCopy,
}: {
  taskTitle: string;
  description?: string | null;
  priority: string;
  deadline: string | null;
  days: number | null;
  leadMinutes?: number | null;
  reminderMode: ReminderMode;
  recipientName: string;
  responsibleName: string;
  managerCopy: boolean;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText(reminderMode, managerCopy, responsibleName, days, leadMinutes)}</Preview>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}>
        <Container style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px" }}>
          <Heading style={{ color: "#3730a3" }}>TaskKeep</Heading>
          <Text>Hola {recipientName},</Text>
          <Text>{managerCopy
            ? managerMessage(reminderMode, responsibleName, days, leadMinutes)
            : userMessage(reminderMode, taskTitle, days, leadMinutes)}</Text>
          <Text><strong>Tarea:</strong> {taskTitle}</Text>
          <Text><strong>Responsable:</strong> {responsibleName}</Text>
          <Text><strong>Prioridad:</strong> {priority}</Text>
          {deadline && <Text><strong>Fecha limite:</strong> {new Date(deadline).toLocaleString("es-EC")}</Text>}
          {description && <Text><strong>Descripcion:</strong> {description}</Text>}
        </Container>
      </Body>
    </Html>
  );
}

function previewText(mode: ReminderMode, managerCopy: boolean, responsibleName: string, days: number | null, leadMinutes?: number | null) {
  if (mode === "deadline") {
    return managerCopy ? `La tarea de ${responsibleName} vence en ${leadLabel(days, leadMinutes)}` : `Tu tarea vence en ${leadLabel(days, leadMinutes)}`;
  }
  return managerCopy ? `Recordatorio de la tarea de ${responsibleName}` : "Recordatorio de tu tarea";
}

function managerMessage(mode: ReminderMode, responsibleName: string, days: number | null, leadMinutes?: number | null) {
  if (mode === "deadline") return `La tarea asignada a ${responsibleName} vence en ${leadLabel(days, leadMinutes)}.`;
  return `Este es el recordatorio ${mode === "daily" ? "diario" : "mensual"} de la tarea de ${responsibleName}.`;
}

function userMessage(mode: ReminderMode, taskTitle: string, days: number | null, leadMinutes?: number | null) {
  if (mode === "deadline") return `La tarea ${taskTitle} vence en ${leadLabel(days, leadMinutes)}.`;
  return `Este es tu recordatorio ${mode === "daily" ? "diario" : "mensual"} para la tarea ${taskTitle}.`;
}

function leadLabel(days: number | null, leadMinutes?: number | null) {
  if (days) return `${days} dia${days === 1 ? "" : "s"}`;
  const minutes = leadMinutes ?? 0;
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}
