import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api";
import { isDriveConfigured } from "@/lib/google-drive";

export async function GET() {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  return NextResponse.json({
    data: {
      database: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      drive: isDriveConfigured(),
      cron: Boolean(process.env.CRON_SECRET),
      publicUrl: process.env.APP_URL ?? null,
      cookieSecure: process.env.COOKIE_SECURE === "true" || process.env.APP_URL?.startsWith("https://") || false,
    },
  });
}
