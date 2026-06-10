import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { reviewStatusSchema } from "@/lib/validators";

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
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
