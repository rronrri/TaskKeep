import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function TaskReminderEmail({ taskTitle, deadline, days }: { taskTitle: string; deadline: string; days: number }) {
  return (
    <Html><Head /><Preview>{`Tu tarea vence en ${days} día${days === 1 ? "" : "s"}`}</Preview>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}>
        <Container style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px" }}>
          <Heading style={{ color: "#3730a3" }}>TaskKeep</Heading>
          <Text>La tarea <strong>{taskTitle}</strong> vence en {days} día{days === 1 ? "" : "s"}.</Text>
          <Text>Fecha límite: {new Date(deadline).toLocaleString("es-EC")}</Text>
        </Container>
      </Body>
    </Html>
  );
}
