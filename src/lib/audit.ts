import { createAdminClient } from "@/lib/supabase/server";

export async function writeAudit(input: {
  actorId?: string | null;
  companyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await createAdminClient().from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    company_id: input.companyId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("No se pudo registrar auditoría", error.message);
}
