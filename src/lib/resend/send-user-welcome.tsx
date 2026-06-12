import { Resend } from "resend";
import { UserWelcomeEmail } from "@/emails/UserWelcomeEmail";
import type { UserRole } from "@/types";

export async function sendUserWelcomeEmail(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
  companyName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, reason: "El correo no está configurado." };
  }

  try {
    const loginUrl = new URL("/login", process.env.APP_URL ?? "http://localhost:3000").toString();
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.email,
      subject: `Tu acceso a TaskKeep - ${input.companyName}`,
      react: UserWelcomeEmail({ ...input, loginUrl }),
    });

    if (result.error) {
      console.error("No se pudo enviar el correo de bienvenida:", result.error);
      return {
        sent: false,
        reason: result.error.message || "El proveedor rechazó el correo.",
      };
    }

    return { sent: true, messageId: result.data?.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "No se pudo preparar el correo.";
    console.error("No se pudo enviar el correo de bienvenida:", reason);
    return { sent: false, reason };
  }
}
