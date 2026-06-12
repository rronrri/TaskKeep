import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function PasswordResetEmail({ fullName, resetUrl }: { fullName: string; resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Restablece tu contraseña de TaskKeep</Preview>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}>
        <Container style={{ backgroundColor: "#fff", borderRadius: "16px", maxWidth: "560px", padding: "32px" }}>
          <Heading style={{ color: "#3730a3", marginTop: 0 }}>Restablecer contraseña</Heading>
          <Text>Hola {fullName}, recibimos una solicitud para cambiar tu contraseña.</Text>
          <Button href={resetUrl} style={{ backgroundColor: "#4f46e5", borderRadius: "10px", color: "#fff", padding: "12px 20px" }}>Crear nueva contraseña</Button>
          <Text style={{ color: "#64748b", fontSize: "13px", marginTop: "24px" }}>Este enlace vence en 30 minutos y solo puede utilizarse una vez. Si no solicitaste el cambio, ignora este mensaje.</Text>
        </Container>
      </Body>
    </Html>
  );
}
