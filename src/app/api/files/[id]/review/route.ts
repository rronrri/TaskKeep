import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/server";
import { fileReviewSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const input = fileReviewSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("task_files")
      .select("id,task:tasks!inner(company_id)")
      .eq("id", id)
      .eq("approval_status", "pending")
      .eq("task.company_id", auth.user.companyId!)
      .is("deleted_at", null)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Archivo pendiente no encontrado" }, { status: 404 });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("task_files")
      .update({
        approval_status: input.decision,
        reviewed_by: auth.user.id,
        reviewed_at: now,
        review_comment: input.comment || null,
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    await writeAudit({
      actorId: auth.user.id,
      companyId: auth.user.companyId,
      action: `file.${input.decision}`,
      entityType: "task_file",
      entityId: id,
      metadata: { comment: input.comment || null },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
