"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";

interface Log {
  id: string;
  action: string;
  entity_type: string;
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
  "user.deactivated": "Cuenta desactivada",
  "user.reactivated": "Cuenta reactivada",
  "task.created": "Tarea creada",
  "task.updated": "Tarea actualizada",
  "task.status_updated": "Estado actualizado",
  "task.deleted": "Tarea eliminada",
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
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
  return <section><p className="text-sm font-bold text-indigo-600">SEGURIDAD</p><h1 className="font-display text-3xl font-extrabold">Auditoría</h1><p className="mt-2 text-slate-600">Consulta las acciones sensibles realizadas en el sistema.</p><div className="mt-6 flex justify-end"><select value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Todas las acciones</option>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}<div className="card mt-4 overflow-hidden">{logs.length === 0 ? <div className="p-10 text-center"><Activity className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-bold">No hay registros para este filtro.</p></div> : <div className="divide-y divide-slate-200">{logs.map((log) => <article key={log.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="font-bold">{actionLabels[log.action] ?? log.action}</p><p className="mt-1 text-sm text-slate-500">{log.actor?.full_name ?? "Sistema"} · {log.company?.name ?? "Global"}</p></div><time className="text-sm text-slate-500">{new Date(log.created_at).toLocaleString("es-EC")}</time></article>)}</div>}</div>{total > 20 && <div className="mt-5 flex items-center justify-between"><p className="text-sm text-slate-500">Página {page} de {Math.ceil(total / 20)}</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={18} /></button><button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={18} /></button></div></div>}</section>;
}
