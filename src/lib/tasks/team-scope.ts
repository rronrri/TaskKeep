import type { createAdminClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * El "equipo" de un/a gestor/a es él/ella mismo/a más los/las colaboradores/as
 * que creó (`users.created_by`). Tareas, carpetas y revisiones se filtran por
 * este conjunto para que gestores/as de una misma empresa no vean ni gestionen
 * el equipo de otro/a gestor/a.
 *
 * Un/a colaborador/a resuelve al equipo de quien lo/la creó. Si ese/a gestor/a
 * fue borrado/a, el/la colaborador/a queda huérfano/a y solo se ve a sí mismo/a
 * (mismo comportamiento que hoy: nadie puede gestionarlo hasta que admin lo
 * reasigne).
 */
export async function resolveTeamIds(
  supabase: SupabaseClient,
  userId: string,
  role: "manager" | "collaborator",
): Promise<string[]> {
  let managerId = userId;
  if (role === "collaborator") {
    const { data } = await supabase.from("users").select("created_by").eq("id", userId).maybeSingle();
    if (!data?.created_by) return [userId];
    managerId = data.created_by;
  }
  const { data: team } = await supabase
    .from("users")
    .select("id")
    .eq("created_by", managerId)
    .eq("role", "collaborator")
    .is("deleted_at", null);
  return [managerId, ...(team ?? []).map((row) => row.id as string)];
}
