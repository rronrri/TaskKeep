"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCheck, X } from "lucide-react";
import type { TaskStatus } from "@/types";

interface StatusRequest {
  id: string;
  old_status: TaskStatus;
  requested_status: TaskStatus;
  created_at: string;
  task: { id: string; title: string };
  requester: { full_name: string };
}

const labels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
};

export function StatusRequests() {
  const [requests, setRequests] = useState<StatusRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const response = await fetch("/api/manager/status-requests", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las solicitudes");
    setRequests(body.data ?? []);
  };

  useEffect(() => {
    fetch("/api/manager/status-requests", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las solicitudes");
        setRequests(body.data ?? []);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes"))
      .finally(() => setLoading(false));
  }, []);

  const review = async (request: StatusRequest, decision: "approved" | "rejected") => {
    const comment = window.prompt(
      decision === "approved" ? "Comentario opcional para aprobar:" : "Motivo opcional del rechazo:",
    );
    if (comment === null) return;
    setServerError("");
    setNotice("");
    const response = await fetch(`/api/manager/status-requests/${request.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, manager_comment: comment }),
    });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo revisar la solicitud");
    setNotice(decision === "approved" ? "Solicitud aprobada y estado actualizado." : "Solicitud rechazada.");
    await load();
  };

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">APROBACIONES</p>
      <h1 className="font-display text-3xl font-extrabold">Solicitudes de estado</h1>
      <p className="mt-2 text-slate-600">Revisa los cambios solicitados por las colaboradoras.</p>
      {serverError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      <div className="mt-7 space-y-4">
        {loading ? <div className="card p-10 text-center text-slate-500">Cargando solicitudes...</div> : requests.length === 0 ? (
          <div className="card p-10 text-center">
            <ClipboardCheck className="mx-auto text-slate-300" size={40} />
            <p className="mt-4 font-bold">No hay solicitudes pendientes.</p>
          </div>
        ) : requests.map((request) => (
          <article key={request.id} className="card flex flex-wrap items-center justify-between gap-5 p-5">
            <div>
              <h2 className="font-display text-lg font-extrabold">{request.task.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{request.requester.full_name} solicita cambiar de <strong>{labels[request.old_status]}</strong> a <strong>{labels[request.requested_status]}</strong>.</p>
              <time className="mt-2 block text-xs text-slate-500" dateTime={request.created_at}>{new Date(request.created_at).toLocaleString("es-EC")}</time>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void review(request, "rejected")} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700 hover:bg-red-50"><X size={18} />Rechazar</button>
              <button onClick={() => void review(request, "approved")} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"><Check size={18} />Aprobar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
