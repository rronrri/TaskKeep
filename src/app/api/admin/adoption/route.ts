import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_PERIODS = [7, 30, 90];

export async function GET(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  try {
    const requested = Number.parseInt(new URL(request.url).searchParams.get("days") ?? "", 10);
    const days = ALLOWED_PERIODS.includes(requested) ? requested : 30;

    const { data, error } = await createAdminClient().rpc("company_adoption_metrics", {
      period_days: days,
    });
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], period: { days } });
  } catch (error) {
    return apiError(error);
  }
}
