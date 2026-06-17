import { NextResponse } from "next/server";
import { runReminderPlanner } from "@/lib/tasks/schedule-reminders";

// Planner diario: NO envía correos directamente. Programa en Resend (scheduledAt)
// los recordatorios que entran en la ventana de 30 días, de modo que Resend los
// entregue a la hora exacta. La recurrencia infinita y las fechas lejanas se
// re-arman en cada ejecución diaria.
export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await runReminderPlanner();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
