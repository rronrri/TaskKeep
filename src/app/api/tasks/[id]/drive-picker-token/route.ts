import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google-drive/oauth";
import { resolveDriveOwner } from "@/lib/google-drive/resolve-owner";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

// Solo para gestores/as. El token devuelto es el de la cuenta de Google del/de
// la gestor/a dueño/a del equipo de esta tarea (resuelto vía responsible_id) y
// llega hasta el navegador para que Google Picker pueda operar. Entregárselo a
// otra persona supondría darle acceso a la cuenta de Drive de otro/a gestor/a,
// así que solo se emite para quien resulta ser ese/a dueño/a.
export async function GET(_: Request, context: Context) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const query = supabase
      .from("tasks")
      .select("id,responsible_id")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);

    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada o no asignada" }, { status: 404 });

    const owner = await resolveDriveOwner(supabase, auth.user.companyId!, task.responsible_id);
    if (!owner) {
      return NextResponse.json({ error: "El/la gestor/a debe conectar Google Drive" }, { status: 409 });
    }
    if (owner.ownerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Solo quien conectó Google Drive para este equipo puede abrir el selector de carpetas" },
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
