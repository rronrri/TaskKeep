import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";
import { createDriveFolder, isDriveConfigured } from "@/lib/google-drive";

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
    if (isDriveConfigured()) {
      try {
        const folder = await createDriveFolder(data.name, process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!);
        await createAdminClient().from("companies").update({ drive_folder_id: folder.id }).eq("id", data.id);
        data.drive_folder_id = folder.id;
      } catch (driveError) {
        console.error("No se pudo crear la carpeta de empresa", driveError);
      }
    }
    await writeAudit({ actorId: auth.user.id, action: "company.created", entityType: "company", entityId: data.id, metadata: { name: data.name } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
