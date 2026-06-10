import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validators";

export async function GET() {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient()
    .from("companies")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return apiError(error);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  try {
    const input = companySchema.parse(await request.json());
    const { data, error } = await createAdminClient()
      .from("companies")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
