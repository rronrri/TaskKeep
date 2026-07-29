import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google-drive/oauth";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

// Solo para gestores/as. El token devuelto es el de la cuenta de Google conectada
// por el/la gestor/a (`drive_owner_user_id`) y llega hasta el navegador para que
// Google Picker pueda operar. Entregárselo a un/a colaborador/a supondría darle
// acceso directo a toda la cuenta de Drive de otra persona, así que este endpoint
// solo lo emite para su propia cuenta: se exige que quien lo pide sea el/la
// propietario/a de la conexión de Drive de la empresa.
export async function GET(_: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const query = supabase
      .from("tasks")
      .select("id,company:companies!inner(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);

    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada o no asignada" }, { status: 404 });

    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    if (!company?.drive_folder_id || !company.drive_owner_user_id) {
      return NextResponse.json({ error: "El/la gestor/a debe conectar Google Drive y configurar una carpeta raiz" }, { status: 409 });
    }
    if (company.drive_owner_user_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Solo quien conectó Google Drive en esta empresa puede abrir el selector de carpetas" },
        { status: 403 },
      );
    }

    return NextResponse.json({ access_token: await getGoogleAccessToken(auth.user.id) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return apiError(error);
  }
}
