"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, Pencil, Pin, Trash2 } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastMessages } from "@/components/ui/toast-message";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog } from "./task-editor-dialog";
import { TaskPreviewDialog } from "./task-preview-dialog";
import { TaskTimingInfo } from "./task-timing-info";
import { TaskFilters } from "./task-filters";
import { TaskContextMenu } from "./task-context-menu";
import { TaskFolderExplorer, type FolderSelection } from "./task-folder-explorer";
import type { Task, TaskFolder, TaskStatus, UserRole } from "@/types";

const statusLabel: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };
const statusStamp: Record<TaskStatus, string> = {
  pending: "stamp stamp-neutral",
  in_progress: "stamp stamp-primary",
  completed: "stamp stamp-success",
};

export function TaskBoard({ role }: { role: UserRole }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [sort, setSort] = useState("deadline_asc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [editorMode, setEditorMode] = useState<"full" | "reminders">("full");
  const [preview, setPreview] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeAction, setNoticeAction] = useState<{ label: string; onClick: () => Promise<void> | void } | null>(null);
  const [serverError, setServerError] = useState("");
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [folderSelection, setFolderSelection] = useState<FolderSelection>("none");
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const currentFolderId = folderSelection !== "all" && folderSelection !== "none" ? folderSelection : null;

  const loadTasks = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), size: "12", sort });
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    if (folderSelection !== "all") query.set("folder_id", folderSelection);
    const response = await fetch(`/api/tasks?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    setTasks(body.data ?? []);
    setTotal(body.pagination?.total ?? 0);
    setPreview((current) => current ? (body.data ?? []).find((task: Task) => task.id === current.id) ?? null : null);
  }, [deadlineFrom, deadlineTo, folderSelection, page, priority, search, sort, status]);

  useEffect(() => {
    // Initial synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadTasks(), fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()), fetch("/api/task-folders", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, body: await response.json() }))])
      .then(([, me, folderResponse]) => {
        setCurrentUserId(me.user?.id ?? "");
        if (!folderResponse.ok) throw new Error(folderResponse.body.error ?? "No se pudieron cargar las carpetas");
        setFolders(folderResponse.body.data ?? []);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las tareas"));
  }, [loadTasks]);

  const createFolder = async (name: string, parentId: string | null) => {
    const response = await fetch("/api/task-folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parent_id: parentId }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo crear la carpeta");
    setFolders((current) => [...current, body.data].sort((a, b) => a.name.localeCompare(b.name)));
    setNotice(parentId ? "Subcarpeta creada." : "Carpeta creada.");
  };

  const deleteFolder = async (folder: TaskFolder) => {
    const response = await fetch("/api/task-folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: folder.id }) });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo eliminar la carpeta");
      return;
    }
    const deletedIds = (body.data?.deleted_folder_ids ?? [folder.id]) as string[];
    const snapshot = body.data?.snapshot;
    setFolders((current) => current.filter((item) => !deletedIds.includes(item.id)));
    if (folderSelection !== "all" && deletedIds.includes(folderSelection)) setFolderSelection("none");
    await loadTasks();
    setNotice("Carpeta eliminada.");
    setNoticeAction(snapshot ? {
      label: "Deshacer",
      onClick: async () => {
        const restoreResponse = await fetch("/api/task-folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
        const restoreBody = await restoreResponse.json();
        if (!restoreResponse.ok) { setServerError(restoreBody.error ?? "No se pudo deshacer la eliminación"); return; }
        setFolders(restoreBody.data ?? []);
        setNoticeAction(null);
        setNotice("Eliminación deshecha.");
        await loadTasks();
      },
    } : null);
  };

  const moveFolder = async (folderId: string, parentId: string | null) => {
    const response = await fetch(`/api/task-folders/${folderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parent_id: parentId }) });
    const body = await response.json();
    if (!response.ok) { setServerError(body.error ?? "No se pudo mover la carpeta"); return; }
    setFolders((current) => current.map((item) => (item.id === folderId ? body.data : item)).sort((a, b) => a.name.localeCompare(b.name)));
    setNotice(parentId ? "Carpeta movida dentro de otra carpeta." : "Carpeta movida a Mi unidad.");
  };

  const moveTaskToFolder = async (taskId: string, folderId: string | null) => {
    const response = await fetch(`/api/tasks/${taskId}/folder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder_id: folderId }) });
    const body = await response.json();
    if (!response.ok) { setServerError(body.error ?? "No se pudo mover la tarea"); return; }
    setTasks((current) => folderSelection === "all" ? current.map((task) => task.id === taskId ? { ...task, folder_id: folderId } : task) : current.filter((task) => task.id !== taskId));
    setNotice(folderId ? "Tarea movida a la carpeta." : "Tarea movida a Mi unidad.");
    void loadTasks().catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron actualizar las tareas"));
  };

  const requestStatus = async (task: Task, requestedStatus: TaskStatus) => {
    const response = await fetch(`/api/tasks/${task.id}/status-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_status: requestedStatus }),
    });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo enviar la solicitud");
    setPreview(null);
    setNotice(`Solicitud enviada para cambiar "${task.title}" a ${statusLabel[requestedStatus].toLowerCase()}.`);
  };

  const patchOwnTask = async (task: Task, values: Partial<Task>, message: string) => {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo actualizar la tarea");
    setNotice(message);
    await loadTasks();
  };

  const removeOwnTask = async () => {
    if (!deleteTarget) return;
    const response = await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar la tarea");
    setPreview(null);
    setNotice("Tarea personal eliminada.");
    await loadTasks();
  };

  const own = (task: Task) => task.created_by === currentUserId && task.responsible_id === currentUserId;

  const openFullEditor = (task: Task | null) => {
    setEditing(task);
    setEditorMode("full");
    setEditorOpen(true);
  };

  const openReminders = (task: Task) => {
    setEditing(task);
    setEditorMode("reminders");
    setEditorOpen(true);
  };

  const openTaskMenu = (event: React.MouseEvent, task: Task) => {
    if (!own(task)) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ task, x: event.clientX, y: event.clientY });
  };

  const moveContextTask = async (folderId: string | null) => {
    if (!contextMenu) return;
    const task = contextMenu.task;
    setContextMenu(null);
    await moveTaskToFolder(task.id, folderId);
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-3xl font-bold">Tareas</h1></div>
      </div>
      <TaskFilters search={search} status={status} priority={priority} deadlineFrom={deadlineFrom} deadlineTo={deadlineTo} sort={sort} viewMode={viewMode}
        onSearch={(value) => { setPage(1); setSearch(value); }} onStatus={(value) => { setPage(1); setStatus(value); }}
        onPriority={(value) => { setPage(1); setPriority(value); }} onDeadlineFrom={(value) => { setPage(1); setDeadlineFrom(value); }}
        onDeadlineTo={(value) => { setPage(1); setDeadlineTo(value); }} onSort={(value) => { setPage(1); setSort(value); }} onViewMode={setViewMode} />
      <ToastMessages success={notice} error={serverError} successAction={noticeAction} onClearSuccess={() => { setNotice(""); setNoticeAction(null); }} onClearError={() => setServerError("")} />
      <div>
      <TaskFolderExplorer folders={folders} selected={folderSelection} searchQuery={search} onSelect={(folder) => { setPage(1); setFolderSelection(folder); }} onCreate={createFolder} onDelete={deleteFolder} onMoveTask={moveTaskToFolder} onMoveFolder={moveFolder} onNewTask={() => openFullEditor(null)}>
      {tasks.length === 0 ? <div className="col-span-full rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-deep)] p-10 text-center text-[var(--ink-soft)]">No hay tareas para este filtro.</div> : viewMode === "cards" ? (
        <>
          {tasks.map((task) => {
            const overdue = Boolean(task.deadline) && task.status !== "completed" && isBefore(new Date(task.deadline!), new Date());
            const style = priorityStyles[task.priority];
            return <article key={task.id} draggable={own(task)} onContextMenu={(event) => openTaskMenu(event, task)} onDragStart={(event) => { if (!own(task)) return; event.dataTransfer.setData("application/x-taskkeep-task", task.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setPreview(task)} className={`${own(task) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} card ${style.card} p-3.5 text-left`}>
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <span className={`shrink-0 ${style.badge}`}>{style.label}</span>
                <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                  {task.is_pinned && <Pin size={18} aria-label="Tarea fijada" />}
                  {own(task) && <>
                    <button onClick={() => openReminders(task)} title="Configura avisos diarios, mensuales o por fecha límite. El predeterminado se adapta a la fecha." aria-label="Activar recordatorios" className={`rounded-md p-1.5 hover:bg-[var(--paper-deep)] ${task.reminders_enabled ? "text-[#9A7B24]" : ""}`}><BellRing size={17} /></button>
                    <button onClick={() => openFullEditor(task)} className="rounded-md p-1.5 hover:bg-[var(--paper-deep)]" aria-label={`Editar ${task.title}`}><Pencil size={17} /></button>
                    <button onClick={() => setDeleteTarget(task)} className="rounded-md p-1.5 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label={`Eliminar ${task.title}`}><Trash2 size={17} /></button>
                  </>}
                </div>
              </div>
              <div className="block w-full text-left"><h2 className="font-display text-base font-bold">{task.title}</h2>{task.description && <p className="mt-1.5 line-clamp-2 text-xs text-[var(--ink-soft)]">{task.description}</p>}</div>
              <div className="mt-3 space-y-1.5"><p className={`folio flex items-center gap-2 ${overdue ? "!text-[var(--stamp-red)]" : ""}`}><CalendarClock size={15} />{formatDeadline(task.deadline)}{overdue && " · VENCIDA"}</p>{task.reminders_enabled && <p className="folio flex items-center gap-2 !text-[#9A7B24]"><BellRing size={14} /> Recordatorios activos</p>}</div>
              <TaskTimingInfo task={task} compact />
              <div className="mt-3 border-t border-[var(--line)] pt-3"><span className={statusStamp[task.status]}>{statusLabel[task.status]}</span></div>
            </article>;
          })}
        </>
      ) : (
        <div className="card col-span-full overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[var(--paper)] text-xs uppercase text-[var(--ink-soft)]"><tr><th className="px-5 py-4">Tarea</th><th className="px-5 py-4">Fecha límite</th><th className="px-5 py-4">Prioridad</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{tasks.map((task) => { const style = priorityStyles[task.priority]; return <tr key={task.id} draggable={own(task)} onContextMenu={(event) => openTaskMenu(event, task)} onDragStart={(event) => { if (!own(task)) return; event.dataTransfer.setData("application/x-taskkeep-task", task.id); event.dataTransfer.effectAllowed = "move"; }} className={`hover:bg-[var(--paper)] ${own(task) ? "cursor-grab active:cursor-grabbing" : ""}`}><td onClick={() => setPreview(task)} className="cursor-pointer px-5 py-4 font-bold"><span>{task.title}</span><TaskTimingInfo task={task} compact /></td><td className="folio px-5 py-4">{formatDeadline(task.deadline)}</td><td className="px-5 py-4"><span className={style.badge}>{style.label}</span></td><td className="px-5 py-4"><span className={statusStamp[task.status]}>{statusLabel[task.status]}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1">{own(task) && <><button onClick={() => openReminders(task)} title="Configura avisos diarios, mensuales o por fecha límite." aria-label="Activar recordatorios" className="rounded-md p-2 hover:bg-[var(--paper-deep)]"><BellRing size={17} /></button><button onClick={() => openFullEditor(task)} className="rounded-md p-2 hover:bg-[var(--paper-deep)]"><Pencil size={17} /></button><button onClick={() => setDeleteTarget(task)} className="rounded-md p-2 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]"><Trash2 size={17} /></button></>}</div></td></tr>; })}</tbody></table></div>
      )}
      </TaskFolderExplorer>
      </div>
      {total > 12 && <div className="mt-6 flex items-center justify-between"><p className="folio">Página {page} de {Math.ceil(total / 12)} · {total} tareas</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="btn btn-ghost !p-2" aria-label="Página anterior"><ChevronLeft size={19} /></button><button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((value) => value + 1)} className="btn btn-ghost !p-2" aria-label="Página siguiente"><ChevronRight size={19} /></button></div></div>}
      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} task={editing} responsibles={[]} actorRole="collaborator" currentUserId={currentUserId} initialFolderId={currentFolderId} mode={editorMode} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      {contextMenu && <TaskContextMenu task={contextMenu.task} folders={folders} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onMove={moveContextTask} />}
      <TaskPreviewDialog task={preview} onOpenChange={(open) => !open && setPreview(null)} role={role} onRequestStatus={(task, requestedStatus) => own(task) ? void patchOwnTask(task, { status: requestedStatus }, "Estado actualizado.") : void requestStatus(task, requestedStatus)} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea personal" description={`Se eliminará "${deleteTarget?.title ?? ""}".`} confirmLabel="Eliminar tarea" onConfirm={removeOwnTask} />
    </section>
  );
}

function formatDeadline(deadline: string | null) {
  return deadline ? format(new Date(deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite";
}



