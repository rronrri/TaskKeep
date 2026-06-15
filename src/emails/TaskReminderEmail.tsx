import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { ReminderMode } from "@/types";

export function TaskReminderEmail({
  taskTitle,
  description,
  priority,
  deadline,
  days,
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
  reminderMode: ReminderMode;
  recipientName: string;
  responsibleName: string;
  managerCopy: boolean;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText(reminderMode, managerCopy, responsibleName, days)}</Preview>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}>
        <Container style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px" }}>
          <Heading style={{ color: "#3730a3" }}>TaskKeep</Heading>
          <Text>Hola {recipientName},</Text>
          <Text>{managerCopy
            ? managerMessage(reminderMode, responsibleName, days)
            : userMessage(reminderMode, taskTitle, days)}</Text>
          <Text><strong>Tarea:</strong> {taskTitle}</Text>
          <Text><strong>Responsable:</strong> {responsibleName}</Text>
          <Text><strong>Prioridad:</strong> {priority}</Text>
          {deadline && <Text><strong>Fecha límite:</strong> {new Date(deadline).toLocaleString("es-EC")}</Text>}
          {description && <Text><strong>Descripción:</strong> {description}</Text>}
        </Container>
      </Body>
    </Html>
  );
}

function previewText(mode: ReminderMode, managerCopy: boolean, responsibleName: string, days: number | null) {
  if (mode === "deadline") return managerCopy ? `La tarea de ${responsibleName} vence en ${days} días` : `Tu tarea vence en ${days} días`;
  return managerCopy ? `Recordatorio de la tarea de ${responsibleName}` : "Recordatorio de tu tarea";
}

function managerMessage(mode: ReminderMode, responsibleName: string, days: number | null) {
  if (mode === "deadline") return `La tarea asignada a ${responsibleName} vence en ${days} día${days === 1 ? "" : "s"}.`;
  return `Este es el recordatorio ${mode === "daily" ? "diario" : "mensual"} de la tarea de ${responsibleName}.`;
}

function userMessage(mode: ReminderMode, taskTitle: string, days: number | null) {
  if (mode === "deadline") return `La tarea ${taskTitle} vence en ${days} día${days === 1 ? "" : "s"}.`;
  return `Este es tu recordatorio ${mode === "daily" ? "diario" : "mensual"} para la tarea ${taskTitle}.`;
}
