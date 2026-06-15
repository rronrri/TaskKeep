"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";

interface Log {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string; email: string } | null;
  company?: { name: string } | null;
}

const actionLabels: Record<string, string> = {
  "company.created": "Empresa creada",
  "company.updated": "Empresa actualizada",
  "company.deleted": "Empresa eliminada",
  "user.created": "Cuenta creada",
  "user.updated": "Cuenta actualizada",
  "user.deleted": "Cuenta eliminada",
  "task.created": "Tarea creada",
  "task.updated": "Tarea actualizada",
  "task.status_updated": "Estado actualizado",
  "task.deleted": "Tarea eliminada",
  "file.uploaded_approved": "Archivo subido y aprobado",
  "file.uploaded_pending": "Archivo pendiente de aprobación",
  "file.approved": "Archivo aprobado",
  "file.rejected": "Archivo rechazado",
  "file.deleted": "Archivo eliminado",
  "profile.updated": "Perfil actualizado",
  "profile.password_changed": "Contraseña cambiada",
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [selected, setSelected] = useState<Log | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams({ page: String(page) });
    if (action) query.set("action", action);
    fetch(`/api/admin/audit-logs?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la auditoría");
        setLogs(body.data ?? []);
        setTotal(body.pagination?.total ?? 0);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar la auditoría"));
  }, [action, page]);

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">SEGURIDAD</p>
      <h1 className="font-display text-3xl font-extrabold">Auditoría</h1>
      <p className="mt-2 text-slate-600">Consulta las acciones sensibles realizadas en el sistema.</p>
      <div className="mt-6 flex justify-end">
        <select value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
          <option value="">Todas las acciones</option>
          {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      <div className="card mt-4 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-10 text-center"><Activity className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-bold">No hay registros para este filtro.</p></div>
        ) : (
          <div className="divide-y divide-slate-200">
            {logs.map((log) => (
              <article key={log.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-bold">{actionLabels[log.action] ?? log.action}</p>
                  <p className="mt-1 text-sm text-slate-500">{log.actor?.full_name ?? "Sistema"} · {log.company?.name ?? "Global"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <time className="text-sm text-slate-500">{new Date(log.created_at).toLocaleString("es-EC")}</time>
                  <button onClick={() => setSelected(log)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50">
                    <Eye size={16} /> Ver detalle
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {total > 20 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-500">Página {page} de {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={18} /></button>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={18} /></button>
          </div>
        </div>
      )}

      <AppDialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title="Detalle de auditoría" description="Información completa de la acción registrada." size="md">
        {selected && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Acción" value={actionLabels[selected.action] ?? selected.action} />
            <Detail label="Fecha y hora" value={new Date(selected.created_at).toLocaleString("es-EC")} />
            <Detail label="Persona" value={selected.actor ? `${selected.actor.full_name} · ${selected.actor.email}` : "Sistema"} />
            <Detail label="Empresa" value={selected.company?.name ?? "Global"} />
            <Detail label="Tipo de entidad" value={selected.entity_type} />
            <Detail label="ID de entidad" value={selected.entity_id ?? "No disponible"} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Datos adicionales</dt>
              <dd className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                <pre>{JSON.stringify(selected.metadata ?? {}, null, 2)}</pre>
              </dd>
            </div>
          </dl>
        )}
      </AppDialog>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
