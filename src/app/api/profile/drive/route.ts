import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { verifyDriveFolder } from "@/lib/google-drive";
import { parseDriveFolderLink } from "@/lib/google-drive/oauth";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  drive_folder_url: z.union([z.string().url("Ingresa un enlace valido de Google Drive"), z.literal("")]),
});

export async function PATCH(request: Request) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const input = schema.parse(await request.json());
    const supabase = createAdminClient();

    if (!input.drive_folder_url) {
      await supabase.from("companies").update({
        drive_folder_id: null,
        drive_folder_url: null,
        drive_owner_user_id: null,
        drive_connected_at: null,
      }).eq("id", auth.user.companyId!);
    } else {
      const folderId = parseDriveFolderLink(input.drive_folder_url);
      if (!folderId) {
        return NextResponse.json({ error: "No se pudo reconocer el enlace de la carpeta de Google Drive" }, { status: 400 });
      }
      try {
        await verifyDriveFolder(folderId, auth.user.id);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "No se pudo validar la carpeta de Google Drive";
        const message = detail.includes("File not found")
          ? "Google no encuentra esa carpeta con la cuenta conectada. Conecta la cuenta dueña de la carpeta o comparte la carpeta con esa cuenta."
          : detail;
        return NextResponse.json({ error: message }, { status: 400 });
      }
      await supabase.from("companies").update({
        drive_folder_id: folderId,
        drive_folder_url: input.drive_folder_url,
        drive_owner_user_id: auth.user.id,
        drive_connected_at: new Date().toISOString(),
      }).eq("id", auth.user.companyId!);
    }

    const { data, error } = await supabase
      .from("companies")
      .select("name,drive_folder_url,drive_folder_id,drive_connected_at")
      .eq("id", auth.user.companyId!)
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "profile.drive_updated", entityType: "company", entityId: auth.user.companyId! });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
