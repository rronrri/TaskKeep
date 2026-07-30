"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Clock3, FileText, FolderOpen, History, MessageSquare, Pencil, Pin, PinOff, Send, Trash2, Upload, UserRound, X } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { AppDialog } from "@/components/ui/app-dialog";
import { priorityStyles } from "@/lib/tasks/priority-style";
import type { Task, TaskStatus, UserRole } from "@/types";
import { TaskTimingInfo } from "./task-timing-info";

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
  capabilities: { canComment: boolean; canUpload: boolean; canReviewFiles: boolean; currentUserId: string; driveConfigured: boolean; taskFolderId: string | null; taskFolderName: string | null };
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
  const [tab, setTab] = useState<"comments" | "history" | "files">("files");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewFile, setReviewFile] = useState<{ id: string; name: string; decision: "approved" | "rejected" } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [destinationFolder, setDestinationFolder] = useState("");
  const [destinationFolderName, setDestinationFolderName] = useState("");
  const [openingPicker, setOpeningPicker] = useState(false);

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
    if (destinationFolder) form.set("drive_folder_id", destinationFolder);
    const response = await fetch("/api/files/upload", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "No se pudo subir el archivo");
      return;
    }
    setDetail((current) => current ? { ...current, files: [body.data, ...current.files] } : current);
  };

  const openDrivePicker = async () => {
    setError("");
    setOpeningPicker(true);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>((resolve) => window.gapi.load("picker", { callback: resolve }));
      const [configResponse, tokenResponse] = await Promise.all([
        fetch("/api/google/picker-config", { cache: "no-store" }),
        fetch(`/api/tasks/${task.id}/drive-picker-token`, { cache: "no-store" }),
      ]);
      const configBody = await configResponse.json();
      const tokenBody = await tokenResponse.json();
      if (!configResponse.ok) throw new Error(configBody.error ?? "Google Picker no esta configurado");
      if (!tokenResponse.ok) throw new Error(tokenBody.error ?? "No se pudo obtener acceso temporal a Google Drive");

      const folderView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");
      const picker = new window.google.picker.PickerBuilder()
        .setAppId(configBody.appId)
        .setDeveloperKey(configBody.apiKey)
        .setOAuthToken(tokenBody.access_token)
        .addView(folderView)
        .setTitle("Elige la carpeta de Drive para esta tarea")
        .setCallback((data: PickerResponse) => {
          if (data.action !== window.google.picker.Action.PICKED) return;
          const folder = data.docs?.[0];
          if (folder?.id) {
            setDestinationFolder(folder.id);
            setDestinationFolderName(folder.name ?? "Carpeta seleccionada");
          }
        })
        .build();
      picker.setVisible(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir Google Picker");
    } finally {
      setOpeningPicker(false);
    }
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
    setDestinationFolderName("");
  };

  return (
    <AppDialog open onOpenChange={onOpenChange} title={task.title} description="Detalle, conversación y actividad de la tarea." size="lg">
      <div className={`card ${priority.card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={priority.badge}>{priority.label}</span>
          {task.is_pinned && <span className="flex items-center gap-1 text-xs font-bold"><Pin size={15} /> Fijada</span>}
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--ink-soft)]">{task.description || "Sin descripción."}</p>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p className={`flex items-center gap-2 font-semibold ${overdue ? "text-[var(--stamp-red)]" : ""}`}><CalendarClock size={18} /> {task.deadline ? format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite"}{overdue && " · Vencida"}</p>
          <p className="flex items-center gap-2"><UserRound size={18} /> {task.responsible?.full_name ?? "Responsable asignado"}</p>
        </div>
        <TaskTimingInfo task={task} detailed />
      </div>

      {role === "manager" && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-bold">Estado<select value={task.status} onChange={(event) => onStatusChange?.(task, event.target.value as TaskStatus)} className="input mt-2 !py-2.5"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></label>
          <div className="flex flex-wrap items-end gap-2">
            <button onClick={() => onTogglePin?.(task)} className="btn btn-ghost !px-3 !py-2.5">{task.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}{task.is_pinned ? "Desfijar" : "Fijar"}</button>
            <button onClick={() => onEdit?.(task)} className="btn btn-primary !px-3 !py-2.5"><Pencil size={18} /> Editar</button>
            <button onClick={() => onDelete?.(task)} className="rounded-md border border-[var(--stamp-red)] p-2.5 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label="Eliminar tarea"><Trash2 size={18} /></button>
          </div>
        </div>
      )}

      {role === "collaborator" && (
        <label className="mt-5 block text-sm font-bold">Solicitar cambio de estado<select defaultValue="" onChange={(event) => { if (event.target.value) onRequestStatus?.(task, event.target.value as TaskStatus); event.target.value = ""; }} className="input mt-2 !py-2.5"><option value="">Selecciona un estado</option>{(Object.keys(statusLabels) as TaskStatus[]).filter((status) => status !== task.status).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      )}

      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          <Tab active={tab === "files"} onClick={() => setTab("files")} icon={FileText} label={`Archivos ${detail ? `(${detail.files.length})` : ""}`} />
          <Tab active={tab === "comments"} onClick={() => setTab("comments")} icon={MessageSquare} label={`Comentarios ${detail ? `(${detail.comments.length})` : ""}`} />
          <Tab active={tab === "history"} onClick={() => setTab("history")} icon={History} label="Historial" />
        </div>
        {error && <p role="alert" className="mt-4 rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm text-[var(--stamp-red)]">{error}</p>}
        {!detail ? <p className="py-8 text-center text-sm text-[var(--ink-soft)]">Cargando actividad...</p> : tab === "comments" ? (
          <div className="mt-4">
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {detail.comments.length === 0 ? <p className="rounded-md bg-[var(--paper)] p-4 text-sm text-[var(--ink-soft)]">Todavía no hay comentarios.</p> : detail.comments.map((item) => (
                <article key={item.id} className="rounded-md bg-[var(--paper)] p-4"><div className="flex justify-between gap-3"><p className="text-sm font-bold">{item.user?.full_name ?? "Usuario"}</p><time className="folio">{new Date(item.created_at).toLocaleString("es-EC")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-soft)]">{item.comment}</p></article>
              ))}
            </div>
            {detail.capabilities.canComment && <div className="mt-4 flex gap-2"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Escribe un comentario…" className="input min-w-0 flex-1 resize-none !py-2.5" /><button disabled={busy || !comment.trim()} onClick={() => void addComment()} className="btn btn-primary self-end !p-3" aria-label="Publicar comentario"><Send size={19} /></button></div>}
          </div>
        ) : tab === "history" ? (
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {detail.history.length === 0 && detail.requests.length === 0 ? <p className="rounded-md bg-[var(--paper)] p-4 text-sm text-[var(--ink-soft)]">No hay cambios registrados.</p> : <>
              {detail.requests.map((request) => <article key={request.id} className="rounded-md border border-[var(--line)] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p><strong>{request.requester?.full_name ?? "Colaborador/a"}</strong> solicitó {statusLabels[request.requested_status].toLowerCase()}.</p><span className="stamp stamp-neutral">{requestLabels[request.review_status]}</span></div>{request.manager_comment && <p className="mt-2 text-[var(--ink-soft)]">Comentario: {request.manager_comment}</p>}<time className="folio mt-2 block">{new Date(request.created_at).toLocaleString("es-EC")}</time></article>)}
              {detail.history.map((item) => <article key={item.id} className="rounded-md border border-[var(--line)] p-4 text-sm"><p><strong>{item.user?.full_name ?? "Gestor/a"}</strong> cambió el estado de {statusLabels[item.old_status].toLowerCase()} a <strong>{statusLabels[item.new_status].toLowerCase()}</strong>.</p><time className="folio mt-2 block">{new Date(item.created_at).toLocaleString("es-EC")}</time></article>)}
            </>}
          </div>
        ) : (
          <div className="mt-4">
            {/* El selector de carpetas usa un token de la cuenta de Google del/de
                la gestor/a, así que solo se ofrece a quien conectó esa cuenta.
                Los archivos de colaboradores/as van a "Pendientes" y es el/la
                gestor/a quien elige el destino final al aprobarlos. */}
            {role === "manager" && detail.capabilities.canUpload && !detail.capabilities.driveConfigured && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#9A7B24] bg-[#F3EDDC] p-4">
                <p className="text-sm font-semibold text-[#6b5619]">Google Drive no esta configurado. Conecta tu cuenta y elige una carpeta raiz para poder subir archivos.</p>
                <a href="/manager/profile?openDrive=1" className="btn btn-primary !px-3 !py-2 text-sm">
                  <FolderOpen size={17} />
                  Configurar Google Drive
                </a>
              </div>
            )}
            {role === "manager" && detail.capabilities.canUpload && detail.capabilities.driveConfigured && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--primary)] bg-[var(--primary-wash)] p-4">
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">Destino en Google Drive</p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">{destinationFolderName ? `Seleccionado: ${destinationFolderName}` : detail.capabilities.taskFolderName ? `Si no eliges una carpeta, se usara "${detail.capabilities.taskFolderName}".` : "Si no eliges una carpeta, se creara la carpeta principal de la tarea."}</p>
                </div>
                <button type="button" disabled={openingPicker || busy} onClick={() => void openDrivePicker()} className="btn btn-ghost !px-3 !py-2 text-sm !text-[var(--primary)]">
                  <FolderOpen size={17} />
                  {openingPicker ? "Abriendo Google..." : "Elegir carpeta"}
                </button>
              </div>
            )}
            {detail.capabilities.canUpload && <div className="mb-4 rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--paper)] p-4"><label className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-bold ${detail.capabilities.driveConfigured ? "bg-[var(--primary)] text-white" : "cursor-not-allowed bg-[var(--paper-deep)] text-[var(--line-strong)]"}`}><Upload size={18} /> Subir archivo<input type="file" className="hidden" disabled={!detail.capabilities.driveConfigured || busy} accept=".pdf,.png,.jpg,.jpeg,.txt,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.target.value = ""; }} /></label><p className="mt-2 text-xs text-[var(--ink-soft)]">{role === "collaborator" ? "Tu archivo quedará pendiente hasta que un/a gestor/a lo apruebe." : "Los archivos subidos por gestores/as quedan aprobados automáticamente."}</p>{!detail.capabilities.driveConfigured && role === "collaborator" && <p className="mt-2 text-xs font-semibold text-[#9A7B24]">El/la gestor/a debe conectar Google Drive y configurar una carpeta raíz desde su perfil.</p>}</div>}
            {reviewFile && <div className={`mb-4 rounded-md border p-4 ${reviewFile.decision === "approved" ? "border-[#4A7058] bg-[#E9EFEA]" : "border-[var(--stamp-red)] bg-[var(--stamp-red-wash)]"}`}><p className="text-sm font-bold">{reviewFile.decision === "approved" ? "Aprobar" : "Rechazar"} â€œ{reviewFile.name}â€</p>{reviewFile.decision === "approved" && <div className="mt-3 rounded-md border border-[#4A7058] bg-[var(--surface)] p-3"><p className="text-sm font-bold">Guardar en Drive</p><p className="mt-1 text-xs text-[var(--ink-soft)]">{destinationFolderName ? `Seleccionado: ${destinationFolderName}` : "Si no eliges carpeta, se guardara en la carpeta principal de la tarea."}</p><button type="button" disabled={openingPicker || busy} onClick={() => void openDrivePicker()} className="btn btn-ghost mt-3 !px-3 !py-2 text-xs !text-[#4A7058]"><FolderOpen size={15} />{openingPicker ? "Abriendo Google..." : "Elegir carpeta"}</button></div>}<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={2} placeholder="Comentario opcional para el pasante" className="input mt-3 resize-none !py-2 text-sm" /><div className="mt-3 flex justify-end gap-2"><button onClick={() => { setReviewFile(null); setReviewComment(""); setDestinationFolder(""); setDestinationFolderName(""); }} className="btn btn-ghost !px-3 !py-2 text-sm">Cancelar</button><button disabled={busy} onClick={() => void reviewUploadedFile()} className={`btn !px-3 !py-2 text-sm text-white ${reviewFile.decision === "approved" ? "!bg-[#4A7058] hover:!bg-[#3a5946]" : "btn-danger"}`}>Confirmar</button></div></div>}
            <div className="space-y-3">{detail.files.length === 0 ? <p className="rounded-md bg-[var(--paper)] p-4 text-sm text-[var(--ink-soft)]">No hay archivos adjuntos.</p> : detail.files.map((file) => {
              const canRemove = detail.capabilities.canReviewFiles || file.uploaded_by === detail.capabilities.currentUserId;
              return <article key={file.id} className="rounded-md border border-[var(--line)] p-3">
                <div className="flex items-center gap-2">
                  <a href={file.drive_web_url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded-md bg-[var(--primary-wash)] p-2 text-[var(--primary)]"><FileText size={20} /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{file.file_name}</p><p className="folio">{formatBytes(file.file_size)} · {file.uploader?.full_name ?? "Usuario"}</p></div>
                  </a>
                  <FileStatus status={file.approval_status} />
                  {canRemove && <button disabled={busy} onClick={() => void removeFile(file.id)} className="rounded-md p-2 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label={`Eliminar ${file.file_name}`}><Trash2 size={17} /></button>}
                </div>
                {file.review_comment && <p className="mt-2 rounded-md bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink-soft)]">Comentario de revisión: {file.review_comment}</p>}
                {detail.capabilities.canReviewFiles && file.approval_status === "pending" && <div className="mt-3 flex justify-end gap-2 border-t border-[var(--line)] pt-3"><button onClick={() => { setReviewFile({ id: file.id, name: file.file_name, decision: "rejected" }); setReviewComment(""); setDestinationFolder(""); setDestinationFolderName(""); }} className="flex items-center gap-1 rounded-md border border-[var(--stamp-red)] px-3 py-2 text-xs font-bold text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]"><X size={15} /> Rechazar</button><button onClick={() => { setReviewFile({ id: file.id, name: file.file_name, decision: "approved" }); setReviewComment(""); setDestinationFolder(""); setDestinationFolderName(""); }} className="flex items-center gap-1 rounded-md bg-[#4A7058] px-3 py-2 text-xs font-bold text-white hover:bg-[#3a5946]"><Check size={15} /> Aprobar</button></div>}
              </article>;
            })}</div>
          </div>
        )}
      </div>
    </AppDialog>
  );
}

function FileStatus({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <span className="stamp stamp-success shrink-0"><Check size={13} /> Aprobado</span>;
  if (status === "rejected") return <span className="stamp stamp-danger shrink-0"><X size={13} /> Rechazado</span>;
  return <span className="stamp stamp-medium shrink-0"><Clock3 size={13} /> Pendiente</span>;
}

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof MessageSquare; label: string }) {
  return <button role="tab" aria-selected={active} onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${active ? "bg-[var(--primary-wash)] text-[var(--primary)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]"}`}><Icon size={17} />{label}</button>;
}

function formatBytes(value?: number | null) {
  if (!value) return "Tamaño no disponible";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Picker"));
    document.body.appendChild(script);
  });
}

type PickerResponse = { action: string; docs?: Array<{ id: string; name?: string }> };

