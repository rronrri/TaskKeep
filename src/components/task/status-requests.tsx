"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCheck, ExternalLink, FileText, X } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import type { TaskStatus } from "@/types";

interface StatusRequest {
  id: string;
  old_status: TaskStatus;
  requested_status: TaskStatus;
  created_at: string;
  task: { id: string; title: string };
  requester: { full_name: string };
}

interface FileRequest {
  id: string;
  file_name: string;
  file_size?: number | null;
  drive_web_url: string;
  created_at: string;
  task: { id: string; title: string };
  uploader: { full_name: string };
}

const labels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
};

export function StatusRequests() {
  const [requests, setRequests] = useState<StatusRequest[]>([]);
  const [fileRequests, setFileRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewTarget, setReviewTarget] = useState<StatusRequest | null>(null);
  const [fileTarget, setFileTarget] = useState<FileRequest | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = async () => {
    const [statusResponse, filesResponse] = await Promise.all([
      fetch("/api/manager/status-requests", { cache: "no-store" }),
      fetch("/api/manager/file-requests", { cache: "no-store" }),
    ]);
    const statusBody = await statusResponse.json();
    const filesBody = await filesResponse.json();
    if (!statusResponse.ok) throw new Error(statusBody.error ?? "No se pudieron cargar las solicitudes");
    if (!filesResponse.ok) throw new Error(filesBody.error ?? "No se pudieron cargar los archivos pendientes");
    setRequests(statusBody.data ?? []);
    setFileRequests(filesBody.data ?? []);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/manager/status-requests", { cache: "no-store" }),
      fetch("/api/manager/file-requests", { cache: "no-store" }),
    ])
      .then(async ([statusResponse, filesResponse]) => {
        const statusBody = await statusResponse.json();
        const filesBody = await filesResponse.json();
        if (!statusResponse.ok) throw new Error(statusBody.error ?? "No se pudieron cargar las solicitudes");
        if (!filesResponse.ok) throw new Error(filesBody.error ?? "No se pudieron cargar los archivos pendientes");
        setRequests(statusBody.data ?? []);
        setFileRequests(filesBody.data ?? []);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las aprobaciones"))
      .finally(() => setLoading(false));
  }, []);

  const openStatusReview = (request: StatusRequest, nextDecision: "approved" | "rejected") => {
    setReviewTarget(request);
    setFileTarget(null);
    setDecision(nextDecision);
    setComment("");
  };

  const openFileReview = (file: FileRequest, nextDecision: "approved" | "rejected") => {
    setFileTarget(file);
    setReviewTarget(null);
    setDecision(nextDecision);
    setComment("");
  };

  const review = async () => {
    if (!reviewTarget && !fileTarget) return;
    setReviewing(true);
    setServerError("");
    setNotice("");
    const response = reviewTarget
      ? await fetch(`/api/manager/status-requests/${reviewTarget.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, manager_comment: comment }),
        })
      : await fetch(`/api/files/${fileTarget!.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comment }),
        });
    const body = await response.json();
    setReviewing(false);
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo completar la revisión");
      return;
    }
    const wasFile = Boolean(fileTarget);
    setReviewTarget(null);
    setFileTarget(null);
    setNotice(wasFile
      ? decision === "approved" ? "Archivo aprobado correctamente." : "Archivo rechazado."
      : decision === "approved" ? "Solicitud aprobada y estado actualizado." : "Solicitud rechazada.");
    await load();
  };

  if (loading) return <div className="card p-10 text-center text-slate-500">Cargando aprobaciones...</div>;

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">APROBACIONES</p>
      <h1 className="font-display text-3xl font-extrabold">Centro de aprobaciones</h1>
      <p className="mt-2 text-slate-600">Revisa cambios de estado y archivos enviados por pasantes.</p>
      {serverError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <ApprovalSection title="Cambios de estado" count={requests.length} icon={ClipboardCheck}>
          {requests.length === 0 ? <Empty text="No hay cambios de estado pendientes." /> : requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-display font-extrabold">{request.task.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{request.requester.full_name} solicita cambiar de <strong>{labels[request.old_status]}</strong> a <strong>{labels[request.requested_status]}</strong>.</p>
              <time className="mt-2 block text-xs text-slate-500">{new Date(request.created_at).toLocaleString("es-EC")}</time>
              <ReviewButtons onReject={() => openStatusReview(request, "rejected")} onApprove={() => openStatusReview(request, "approved")} />
            </article>
          ))}
        </ApprovalSection>

        <ApprovalSection title="Archivos de pasantes" count={fileRequests.length} icon={FileText}>
          {fileRequests.length === 0 ? <Empty text="No hay archivos pendientes de aprobación." /> : fileRequests.map((file) => (
            <article key={file.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="truncate font-display font-extrabold">{file.file_name}</h3><p className="mt-1 text-sm text-slate-600">{file.uploader.full_name} · {file.task.title}</p><p className="mt-1 text-xs text-slate-500">{formatBytes(file.file_size)} · {new Date(file.created_at).toLocaleString("es-EC")}</p></div>
                <a href={file.drive_web_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-2 text-indigo-700 hover:bg-indigo-50" aria-label={`Abrir ${file.file_name}`}><ExternalLink size={17} /></a>
              </div>
              <ReviewButtons onReject={() => openFileReview(file, "rejected")} onApprove={() => openFileReview(file, "approved")} />
            </article>
          ))}
        </ApprovalSection>
      </div>

      <AppDialog
        open={Boolean(reviewTarget || fileTarget)}
        onOpenChange={(open) => { if (!open) { setReviewTarget(null); setFileTarget(null); } }}
        title={decision === "approved" ? "Aprobar solicitud" : "Rechazar solicitud"}
        description={reviewTarget
          ? `${reviewTarget.requester.full_name} solicita cambiar “${reviewTarget.task.title}” a ${labels[reviewTarget.requested_status].toLowerCase()}.`
          : fileTarget ? `${fileTarget.uploader.full_name} subió “${fileTarget.file_name}” en ${fileTarget.task.title}.` : undefined}
        size="sm"
      >
        <label className="block text-sm font-semibold">
          {decision === "approved" ? "Comentario opcional" : "Motivo opcional del rechazo"}
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => { setReviewTarget(null); setFileTarget(null); }} className="rounded-xl border border-slate-300 px-4 py-2.5 font-bold">Cancelar</button>
          <button type="button" disabled={reviewing} onClick={() => void review()} className={`rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60 ${decision === "approved" ? "bg-emerald-600" : "bg-red-600"}`}>
            {reviewing ? "Procesando..." : decision === "approved" ? "Aprobar" : "Rechazar"}
          </button>
        </div>
      </AppDialog>
    </section>
  );
}

function ApprovalSection({ title, count, icon: Icon, children }: { title: string; count: number; icon: typeof ClipboardCheck; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-700"><Icon size={20} /></span><h2 className="font-display text-lg font-extrabold">{title}</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count}</span></div><div className="space-y-3 p-4">{children}</div></section>;
}

function ReviewButtons({ onReject, onApprove }: { onReject: () => void; onApprove: () => void }) {
  return <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3"><button onClick={onReject} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><X size={15} /> Rechazar</button><button onClick={onApprove} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check size={15} /> Aprobar</button></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">{text}</p>;
}

function formatBytes(value?: number | null) {
  if (!value) return "Tamaño no disponible";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
