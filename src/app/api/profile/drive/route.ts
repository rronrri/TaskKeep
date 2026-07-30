import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { isValidDriveId, verifyDriveFolder } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/server";

// La carpeta llega elegida desde Google Picker: se recibe su identificador, que es
// lo que queda autorizado para la app bajo el alcance `drive.file`. El enlace es
// solo para mostrarlo en la interfaz. Cadena vacía en `drive_folder_id` significa
// desconectar la carpeta.
const schema = z.object({
  drive_folder_id: z.union([z.string().trim().min(10).max(200), z.literal("")]),
  drive_folder_url: z.string().url().optional().nullable(),
  drive_folder_name: z.string().trim().min(1).max(200).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const input = schema.parse(await request.json());
    const supabase = createAdminClient();

    if (!input.drive_folder_id) {
      await supabase.from("companies").update({
        drive_folder_id: null,
        drive_folder_url: null,
        drive_folder_name: null,
        drive_owner_user_id: null,
        drive_connected_at: null,
      }).eq("id", auth.user.companyId!);
    } else {
      const folderId = input.drive_folder_id;
      if (!isValidDriveId(folderId)) {
        return NextResponse.json({ error: "El identificador de carpeta de Google Drive no es válido" }, { status: 400 });
      }
      let verified: { id: string; name: string; webViewLink: string };
      try {
        verified = await verifyDriveFolder(folderId, auth.user.id);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "No se pudo validar la carpeta de Google Drive";
        // Con el alcance `drive.file`, "File not found" significa casi siempre que
        // la carpeta no se eligió con el Picker en esta misma cuenta.
        const message = detail.includes("File not found")
          ? "Google no encuentra esa carpeta. Vuelve a elegirla con el selector de Google Drive usando la cuenta que conectaste."
          : detail;
        return NextResponse.json({ error: message }, { status: 400 });
      }
      await supabase.from("companies").update({
        drive_folder_id: folderId,
        drive_folder_url: input.drive_folder_url || verified.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
        drive_folder_name: input.drive_folder_name || verified.name,
        drive_owner_user_id: auth.user.id,
        drive_connected_at: new Date().toISOString(),
      }).eq("id", auth.user.companyId!);
    }

    const { data, error } = await supabase
      .from("companies")
      .select("name,drive_folder_url,drive_folder_id,drive_folder_name,drive_connected_at")
      .eq("id", auth.user.companyId!)
      .single();
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "profile.drive_updated", entityType: "company", entityId: auth.user.companyId! });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
