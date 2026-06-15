import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { UserRole } from "@/types";

const roleLabels: Record<UserRole, string> = {
  admin: "administración",
  manager: "gestor/a",
  collaborator: "colaborador/a",
};

export function UserWelcomeEmail({
  fullName,
  email,
  temporaryPassword,
  role,
  companyName,
  loginUrl,
}: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
  companyName: string;
  loginUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`Tu cuenta de ${roleLabels[role]} en TaskKeep está lista`}</Preview>
      <Body style={{ backgroundColor: "#f6f7fb", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "16px", maxWidth: "560px", padding: "32px" }}>
          <Heading style={{ color: "#3730a3", marginTop: "0" }}>Bienvenida a TaskKeep</Heading>
          <Text>Hola {fullName},</Text>
          <Text>
            Se creó tu cuenta como <strong>{roleLabels[role]}</strong> de <strong>{companyName}</strong>.
          </Text>
          <Text style={{ backgroundColor: "#f8fafc", borderRadius: "10px", padding: "16px" }}>
            <strong>Correo:</strong> {email}
            <br />
            <strong>Contraseña temporal:</strong> {temporaryPassword}
          </Text>
          <Button href={loginUrl} style={{ backgroundColor: "#4f46e5", borderRadius: "10px", color: "#ffffff", padding: "12px 20px" }}>
            Iniciar sesión
          </Button>
          <Hr style={{ borderColor: "#e2e8f0", margin: "28px 0" }} />
          <Text style={{ color: "#64748b", fontSize: "13px" }}>
            Por seguridad, cambia la contraseña temporal cuando recibas acceso a esa opción.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
