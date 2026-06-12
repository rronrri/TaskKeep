import { Resend } from "resend";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail";

export async function sendPasswordResetEmail(input: { fullName: string; email: string; token: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: "El correo no está configurado." };

  try {
    const resetUrl = new URL(
      `/reset-password?token=${encodeURIComponent(input.token)}`,
      process.env.APP_URL ?? "http://localhost:3000",
    ).toString();
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.email,
      subject: "Restablece tu contraseña de TaskKeep",
      react: PasswordResetEmail({ fullName: input.fullName, resetUrl }),
    });
    if (result.error) return { sent: false, reason: result.error.message };
    return { sent: true, messageId: result.data?.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "No se pudo preparar el correo.";
    console.error("No se pudo enviar el correo de recuperación:", reason);
    return { sent: false, reason };
  }
}
