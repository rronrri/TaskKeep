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

  if (loading) return <div className="card p-10 text-center text-[var(--ink-soft)]">Cargando aprobaciones...</div>;

  return (
    <section>
      <p className="folio !text-[var(--primary)]">APROBACIONES</p>
      <h1 className="font-display text-3xl font-bold">Centro de aprobaciones</h1>
      <p className="mt-2 text-[var(--ink-soft)]">Revisa cambios de estado y archivos enviados por pasantes.</p>
      {serverError && <p role="alert" className="mt-6 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-lg bg-[#E9EFEA] p-4 text-sm font-semibold text-[#4A7058]">{notice}</p>}

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <ApprovalSection title="Cambios de estado" count={requests.length} icon={ClipboardCheck}>
          {requests.length === 0 ? <Empty text="No hay cambios de estado pendientes." /> : requests.map((request) => (
            <article key={request.id} className="rounded-md border border-[var(--line)] p-4">
              <h3 className="font-display font-bold">{request.task.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{request.requester.full_name} solicita cambiar de <strong>{labels[request.old_status]}</strong> a <strong>{labels[request.requested_status]}</strong>.</p>
              <time className="folio mt-2 block">{new Date(request.created_at).toLocaleString("es-EC")}</time>
              <ReviewButtons onReject={() => openStatusReview(request, "rejected")} onApprove={() => openStatusReview(request, "approved")} />
            </article>
          ))}
        </ApprovalSection>

        <ApprovalSection title="Archivos de pasantes" count={fileRequests.length} icon={FileText}>
          {fileRequests.length === 0 ? <Empty text="No hay archivos pendientes de aprobación." /> : fileRequests.map((file) => (
            <article key={file.id} className="rounded-md border border-[var(--line)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="truncate font-display font-bold">{file.file_name}</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">{file.uploader.full_name} · {file.task.title}</p><p className="folio mt-1">{formatBytes(file.file_size)} · {new Date(file.created_at).toLocaleString("es-EC")}</p></div>
                <a href={file.drive_web_url} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] p-2 text-[var(--primary)] hover:bg-[var(--primary-wash)]" aria-label={`Abrir ${file.file_name}`}><ExternalLink size={17} /></a>
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
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="input mt-2 resize-y !py-2.5" />
        </label>
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className={`stamp-seal ${decision === "approved" ? "text-[#4A7058]" : "text-[var(--stamp-red)]"}`}>{decision === "approved" ? "Aprobado" : "Rechazado"}</span>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setReviewTarget(null); setFileTarget(null); }} className="btn btn-ghost">Cancelar</button>
            <button type="button" disabled={reviewing} onClick={() => void review()} className={`btn text-white ${decision === "approved" ? "!bg-[#4A7058] hover:!bg-[#3a5946]" : "btn-danger"}`}>
              {reviewing ? "Procesando..." : decision === "approved" ? "Aprobar" : "Rechazar"}
            </button>
          </div>
        </div>
      </AppDialog>
    </section>
  );
}

function ApprovalSection({ title, count, icon: Icon, children }: { title: string; count: number; icon: typeof ClipboardCheck; children: React.ReactNode }) {
  return <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--line)] p-5"><div className="flex items-center gap-3"><span className="rounded-md bg-[var(--primary-wash)] p-2 text-[var(--primary)]"><Icon size={20} /></span><h2 className="font-display text-lg font-bold">{title}</h2></div><span className="stamp stamp-neutral">{count}</span></div><div className="space-y-3 p-4">{children}</div></section>;
}

function ReviewButtons({ onReject, onApprove }: { onReject: () => void; onApprove: () => void }) {
  return <div className="mt-4 flex justify-end gap-2 border-t border-[var(--line)] pt-3"><button onClick={onReject} className="flex items-center gap-1 rounded-md border border-[var(--stamp-red)] px-3 py-2 text-xs font-bold text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]"><X size={15} /> Rechazar</button><button onClick={onApprove} className="flex items-center gap-1 rounded-md bg-[#4A7058] px-3 py-2 text-xs font-bold text-white hover:bg-[#3a5946]"><Check size={15} /> Aprobar</button></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-[var(--paper)] p-5 text-center text-sm text-[var(--ink-soft)]">{text}</p>;
}

function formatBytes(value?: number | null) {
  if (!value) return "Tamaño no disponible";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
