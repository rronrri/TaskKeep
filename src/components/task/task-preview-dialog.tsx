"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Clock3, FileText, History, MessageSquare, Pencil, Pin, PinOff, Send, Trash2, Upload, UserRound, X } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { AppDialog } from "@/components/ui/app-dialog";
import { priorityStyles } from "@/lib/tasks/priority-style";
import type { Task, TaskStatus, UserRole } from "@/types";

const statusLabels: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };
const requestLabels = { pending_review: "Pendiente de revisión", approved: "Aprobada", rejected: "Rechazada" };

interface TaskDetail {
  comments: Array<{ id: string; comment: string; created_at: string; user?: { full_name: string; role: UserRole } | null }>;
  history: Array<{ id: string; old_status: TaskStatus; new_status: TaskStatus; source: string; created_at: string; user?: { full_name: string } | null }>;
  requests: Array<{ id: string; old_status: TaskStatus; requested_status: TaskStatus; review_status: keyof typeof requestLabels; manager_comment?: string | null; created_at: string; requester?: { full_name: string } | null; reviewer?: { full_name: string } | null }>;
  files: Array<{
    id: string;
    uploaded_by: string;
    file_name: string;
    mime_type?: string | null;
    file_size?: number | null;
    drive_web_url: string;
    created_at: string;
    approval_status: "pending" | "approved" | "rejected";
    review_comment?: string | null;
    uploader?: { full_name: string; role: UserRole } | null;
    reviewer?: { full_name: string } | null;
  }>;
  capabilities: { canComment: boolean; canUpload: boolean; canReviewFiles: boolean; currentUserId: string; driveConfigured: boolean };
}

export function TaskPreviewDialog({
  task,
  onOpenChange,
  role,
  onEdit,
  onTogglePin,
  onDelete,
  onStatusChange,
  onRequestStatus,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
  onEdit?: (task: Task) => void;
  onTogglePin?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  onRequestStatus?: (task: Task, status: TaskStatus) => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [tab, setTab] = useState<"comments" | "history" | "files">("comments");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewFile, setReviewFile] = useState<{ id: string; name: string; decision: "approved" | "rejected" } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [destinationFolder, setDestinationFolder] = useState("");
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!task) return;
    fetch(`/api/tasks/${task.id}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el detalle");
        setDetail({ comments: body.comments, history: body.history, requests: body.requests, files: body.files, capabilities: body.capabilities });
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle"));
  }, [task]);

  if (!task) return null;
  const priority = priorityStyles[task.priority];
  const overdue = Boolean(task.deadline) && task.status !== "completed" && isBefore(new Date(task.deadline!), new Date());

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo publicar el comentario");
      return;
    }
    setComment("");
    setDetail((current) => current ? { ...current, comments: [...current.comments, body.data] } : current);
  };

  const removeFile = async (fileId: string) => {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo eliminar el archivo");
      return;
    }
    setDetail((current) => current ? { ...current, files: current.files.filter((file) => file.id !== fileId) } : current);
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("task_id", task.id);
    form.set("file", file);
    const response = await fetch("/api/files/upload", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo subir el archivo");
      return;
    }
    setDetail((current) => current ? { ...current, files: [body.data, ...current.files] } : current);
  };

  const loadFolders = async (force = false) => {
    if (!force && folders.length > 0) return;
    const response = await fetch(`/api/tasks/${task.id}/drive-folders`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "No se pudieron cargar las carpetas de Drive");
      return;
    }
    setDestinationFolder(body.data.rootTaskFolderId ?? "");
    setFolders(body.data.folders ?? []);
  };

  const reviewUploadedFile = async () => {
    if (!reviewFile) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/files/${reviewFile.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: reviewFile.decision, comment: reviewComment, drive_folder_id: destinationFolder || undefined }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo revisar el archivo");
      return;
    }
    setDetail((current) => current ? {
      ...current,
      files: current.files.map((file) => file.id === reviewFile.id
        ? { ...file, approval_status: reviewFile.decision, review_comment: reviewComment || null }
        : file),
    } : current);
    setReviewFile(null);
    setReviewComment("");
    setDestinationFolder("");
  };

  return (
    <AppDialog open onOpenChange={onOpenChange} title={task.title} description="Detalle, conversación y actividad de la tarea." size="lg">
      <div className={`rounded-2xl border p-5 ${priority.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${priority.badge}`}>Prioridad {priority.label}</span>
          {task.is_pinned && <span className="flex items-center gap-1 text-xs font-bold"><Pin size={15} /> Fijada</span>}
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description || "Sin descripción."}</p>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}><CalendarClock size={18} /> {task.deadline ? format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite"}{overdue && " · Vencida"}</p>
          <p className="flex items-center gap-2"><UserRound size={18} /> {task.responsible?.full_name ?? "Responsable asignado"}</p>
        </div>
      </div>

      {role === "manager" && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-bold">Estado<select value={task.status} onChange={(event) => onStatusChange?.(task, event.target.value as TaskStatus)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></label>
          <div className="flex flex-wrap items-end gap-2">
            <button onClick={() => onTogglePin?.(task)} className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 font-bold hover:bg-slate-50">{task.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}{task.is_pinned ? "Desfijar" : "Fijar"}</button>
            <button onClick={() => onEdit?.(task)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 font-bold text-white"><Pencil size={18} /> Editar</button>
            <button onClick={() => onDelete?.(task)} className="rounded-xl border border-red-200 p-2.5 text-red-700 hover:bg-red-50" aria-label="Eliminar tarea"><Trash2 size={18} /></button>
          </div>
        </div>
      )}

      {role === "collaborator" && (
        <label className="mt-5 block text-sm font-bold">Solicitar cambio de estado<select defaultValue="" onChange={(event) => { if (event.target.value) onRequestStatus?.(task, event.target.value as TaskStatus); event.target.value = ""; }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Selecciona un estado</option>{(Object.keys(statusLabels) as TaskStatus[]).filter((status) => status !== task.status).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      )}

      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          <Tab active={tab === "comments"} onClick={() => setTab("comments")} icon={MessageSquare} label={`Comentarios ${detail ? `(${detail.comments.length})` : ""}`} />
          <Tab active={tab === "history"} onClick={() => setTab("history")} icon={History} label="Historial" />
          <Tab active={tab === "files"} onClick={() => setTab("files")} icon={FileText} label={`Archivos ${detail ? `(${detail.files.length})` : ""}`} />
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!detail ? <p className="py-8 text-center text-sm text-slate-500">Cargando actividad...</p> : tab === "comments" ? (
          <div className="mt-4">
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {detail.comments.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Todavía no hay comentarios.</p> : detail.comments.map((item) => (
                <article key={item.id} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><p className="text-sm font-bold">{item.user?.full_name ?? "Usuario"}</p><time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString("es-EC")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.comment}</p></article>
              ))}
            </div>
            {detail.capabilities.canComment && <div className="mt-4 flex gap-2"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Escribe un comentario…" className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5" /><button disabled={busy || !comment.trim()} onClick={() => void addComment()} className="self-end rounded-xl bg-indigo-600 p-3 text-white disabled:opacity-50" aria-label="Publicar comentario"><Send size={19} /></button></div>}
          </div>
        ) : tab === "history" ? (
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {detail.history.length === 0 && detail.requests.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay cambios registrados.</p> : <>
              {detail.requests.map((request) => <article key={request.id} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p><strong>{request.requester?.full_name ?? "Colaborador/a"}</strong> solicitó {statusLabels[request.requested_status].toLowerCase()}.</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{requestLabels[request.review_status]}</span></div>{request.manager_comment && <p className="mt-2 text-slate-600">Comentario: {request.manager_comment}</p>}<time className="mt-2 block text-xs text-slate-500">{new Date(request.created_at).toLocaleString("es-EC")}</time></article>)}
              {detail.history.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm"><p><strong>{item.user?.full_name ?? "Gestor/a"}</strong> cambió el estado de {statusLabels[item.old_status].toLowerCase()} a <strong>{statusLabels[item.new_status].toLowerCase()}</strong>.</p><time className="mt-2 block text-xs text-slate-500">{new Date(item.created_at).toLocaleString("es-EC")}</time></article>)}
            </>}
          </div>
        ) : (
          <div className="mt-4">
            {detail.capabilities.canUpload && <div className="mb-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4"><label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold ${detail.capabilities.driveConfigured ? "bg-indigo-600 text-white" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}><Upload size={18} /> Subir archivo<input type="file" className="hidden" disabled={!detail.capabilities.driveConfigured || busy} accept=".pdf,.png,.jpg,.jpeg,.txt,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.target.value = ""; }} /></label><p className="mt-2 text-xs text-slate-600">{role === "collaborator" ? "Tu archivo quedará pendiente hasta que un/a gestor/a lo apruebe." : "Los archivos subidos por gestores/as quedan aprobados automáticamente."}</p>{!detail.capabilities.driveConfigured && <p className="mt-2 text-xs font-semibold text-amber-700">El/la gestor/a debe conectar Google Drive y configurar una carpeta raíz desde su perfil.</p>}</div>}
            {reviewFile && <div className={`mb-4 rounded-xl border p-4 ${reviewFile.decision === "approved" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="text-sm font-bold">{reviewFile.decision === "approved" ? "Aprobar" : "Rechazar"} “{reviewFile.name}”</p>{reviewFile.decision === "approved" && <label className="mt-3 block text-sm font-bold">Guardar en Drive<select value={destinationFolder} onFocus={() => void loadFolders()} onChange={(event) => setDestinationFolder(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value={destinationFolder}>Carpeta principal de la tarea</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-600">Si necesitas más subcarpetas, créalas en Drive dentro de la carpeta de la tarea y vuelve a abrir este selector.</span></label>}<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={2} placeholder="Comentario opcional para el pasante" className="mt-3 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /><div className="mt-3 flex justify-end gap-2"><button onClick={() => { setReviewFile(null); setReviewComment(""); setDestinationFolder(""); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold">Cancelar</button><button disabled={busy} onClick={() => void reviewUploadedFile()} className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${reviewFile.decision === "approved" ? "bg-emerald-600" : "bg-red-600"}`}>Confirmar</button></div></div>}
            <div className="space-y-3">{detail.files.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay archivos adjuntos.</p> : detail.files.map((file) => {
              const canRemove = detail.capabilities.canReviewFiles || file.uploaded_by === detail.capabilities.currentUserId;
              return <article key={file.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <a href={file.drive_web_url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded-lg bg-slate-100 p-2 text-indigo-600"><FileText size={20} /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{file.file_name}</p><p className="text-xs text-slate-500">{formatBytes(file.file_size)} · {file.uploader?.full_name ?? "Usuario"}</p></div>
                  </a>
                  <FileStatus status={file.approval_status} />
                  {canRemove && <button disabled={busy} onClick={() => void removeFile(file.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label={`Eliminar ${file.file_name}`}><Trash2 size={17} /></button>}
                </div>
                {file.review_comment && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Comentario de revisión: {file.review_comment}</p>}
                {detail.capabilities.canReviewFiles && file.approval_status === "pending" && <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3"><button onClick={() => { setReviewFile({ id: file.id, name: file.file_name, decision: "rejected" }); setReviewComment(""); setDestinationFolder(""); setFolders([]); }} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><X size={15} /> Rechazar</button><button onClick={() => { setReviewFile({ id: file.id, name: file.file_name, decision: "approved" }); setReviewComment(""); setDestinationFolder(""); setFolders([]); void loadFolders(true); }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check size={15} /> Aprobar</button></div>}
              </article>;
            })}</div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}

function FileStatus({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"><Check size={13} /> Aprobado</span>;
  if (status === "rejected") return <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700"><X size={13} /> Rechazado</span>;
  return <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"><Clock3 size={13} /> Pendiente</span>;
}

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof MessageSquare; label: string }) {
  return <button role="tab" aria-selected={active} onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${active ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}><Icon size={17} />{label}</button>;
}

function formatBytes(value?: number | null) {
  if (!value) return "Tamaño no disponible";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
