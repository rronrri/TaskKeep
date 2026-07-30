import type { createAdminClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * Cada gestor/a tiene su propia conexión de Google Drive (ya no hay una sola
 * por empresa). El "dueño/a" de las operaciones de Drive de una tarea es
 * quien la tiene asignada (`responsible_id`): si es un/a gestor/a, su propia
 * conexión; si es un/a colaborador/a, la de quien lo/la creó.
 *
 * Devuelve null si no hay gestor/a resoluble (colaborador/a huérfano/a) o si
 * ese/a gestor/a no conectó Google todavía.
 */
export async function resolveDriveOwner(
  supabase: SupabaseClient,
  companyId: string,
  responsibleId: string,
): Promise<{ ownerId: string } | null> {
  const { data: person } = await supabase
    .from("users")
    .select("id, role, created_by, google_refresh_token_encrypted")
    .eq("id", responsibleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!person) return null;

  if (person.role === "manager") {
    return person.google_refresh_token_encrypted ? { ownerId: person.id } : null;
  }

  if (!person.created_by) return null;
  const { data: manager } = await supabase
    .from("users")
    .select("id, google_refresh_token_encrypted")
    .eq("id", person.created_by)
    .eq("company_id", companyId)
    .eq("role", "manager")
    .maybeSingle();
  if (!manager?.google_refresh_token_encrypted) return null;
  return { ownerId: manager.id };
}
