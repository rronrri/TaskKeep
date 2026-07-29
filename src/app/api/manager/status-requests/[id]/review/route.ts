import { after, NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { reviewStatusSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { syncTaskReminders } from "@/lib/tasks/schedule-reminders";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = reviewStatusSchema.parse(await request.json());
    const { data, error } = await createAdminClient().rpc("review_status_request", {
      request_id: id,
      reviewer_id: auth.user.id,
      reviewer_company_id: auth.user.companyId,
      decision: input.decision,
      review_comment: input.manager_comment ?? null,
    });
    if (error) throw error;

    // Aprobar una solicitud cambia el estado de la tarea, así que hay que
    // reconciliar sus recordatorios igual que hace PATCH /api/tasks/[id]. Sin
    // esto, dar por completada una tarea por esta vía dejaba vivos los avisos ya
    // programados en Resend y seguían llegando durante semanas.
    const taskId = (data as { task_id?: string } | null)?.task_id;
    if (input.decision === "approved" && taskId) {
      after(async () => {
        try {
          await syncTaskReminders(taskId);
        } catch (reason) {
          console.error("No se pudieron reprogramar los recordatorios tras la aprobación", reason);
        }
      });
    }

    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: `status_request.${input.decision}`, entityType: "status_request", entityId: id });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
