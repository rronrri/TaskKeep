"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastMessages } from "@/components/ui/toast-message";
import { priorityStyles, statusSelectStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog, type ResponsibleOption } from "./task-editor-dialog";
import { TaskPreviewDialog } from "./task-preview-dialog";
import { TaskTimingInfo } from "./task-timing-info";
import { TaskFilters } from "./task-filters";
import { TaskContextMenu } from "./task-context-menu";
import { TaskFolderExplorer, type FolderSelection } from "./task-folder-explorer";
import type { Task, TaskFolder, TaskStatus } from "@/types";

interface Responsible extends ResponsibleOption { email: string; }

export function ManagerTaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [preview, setPreview] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"full" | "reminders">("full");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [pinnedFilter, setPinnedFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [sort, setSort] = useState("deadline_asc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeAction, setNoticeAction] = useState<{ label: string; onClick: () => Promise<void> | void } | null>(null);
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [folderSelection, setFolderSelection] = useState<FolderSelection>("none");
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const currentFolderId = folderSelection !== "all" && folderSelection !== "none" ? folderSelection : null;

  const loadTasks = useCallback(async () => {
    const query = new URLSearchParams({ size: "12", page: String(page), sort });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    if (responsibleFilter) query.set("responsible_id", responsibleFilter);
    if (pinnedFilter) query.set("pinned", "true");
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
  }, [deadlineFrom, deadlineTo, folderSelection, page, pinnedFilter, priorityFilter, responsibleFilter, search, sort, statusFilter]);

  useEffect(() => {
    const query = new URLSearchParams({ size: "12", page: String(page), sort });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    if (responsibleFilter) query.set("responsible_id", responsibleFilter);
    if (pinnedFilter) query.set("pinned", "true");
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    if (folderSelection !== "all") query.set("folder_id", folderSelection);
    Promise.all([
      fetch(`/api/tasks?${query}`, { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/task-folders", { cache: "no-store" }),
    ])
      .then(async ([tasksResponse, usersResponse, meResponse, foldersResponse]) => {
        const tasksBody = await tasksResponse.json();
        const usersBody = await usersResponse.json();
        const meBody = await meResponse.json();
        const foldersBody = await foldersResponse.json();
        if (!tasksResponse.ok) throw new Error(tasksBody.error ?? "No se pudieron cargar las tareas");
        if (!usersResponse.ok) throw new Error(usersBody.error ?? "No se pudieron cargar los responsables");
        if (!meResponse.ok) throw new Error(meBody.error ?? "No se pudo cargar la sesión");
        if (!foldersResponse.ok) throw new Error(foldersBody.error ?? "No se pudieron cargar las carpetas");
        setTasks(tasksBody.data ?? []);
        setTotal(tasksBody.pagination?.total ?? 0);
        setFolders(foldersBody.data ?? []);
        const requestedTask = new URLSearchParams(window.location.search).get("task");
        if (requestedTask) {
          setPreview((tasksBody.data ?? []).find((task: Task) => task.id === requestedTask) ?? null);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setResponsibles([
          { id: meBody.user.id, full_name: `${meBody.user.fullName} (yo)`, email: meBody.user.email, role: "manager" },
          ...(usersBody.data ?? []).filter((user: Responsible) => user.id !== meBody.user.id),
        ]);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [deadlineFrom, deadlineTo, folderSelection, page, pinnedFilter, priorityFilter, responsibleFilter, search, sort, statusFilter]);

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

  const openCreate = () => {
    setEditing(null);
    setEditorMode("full");
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setPreview(null);
    setEditing(task);
    setEditorMode("full");
    setEditorOpen(true);
  };

  const openReminders = (task: Task) => {
    setPreview(null);
    setEditing(task);
    setEditorMode("reminders");
    setEditorOpen(true);
  };

  const openTaskMenu = (event: React.MouseEvent, task: Task) => {
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

  const patchTask = async (task: Task, values: Partial<Pick<Task, "is_pinned" | "status" | "reminders_enabled">>, success: string) => {
    setServerError("");
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo actualizar la tarea");
      return;
    }
    setNotice(success);
    await loadTasks();
  };

  const removeTask = async () => {
    if (!deleteTarget) return;
    const response = await fetch(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar la tarea");
    setPreview(null);
    setNotice("Tarea eliminada correctamente.");
    await loadTasks();
  };

  const actions = (task: Task) => (
    <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
      <button onClick={() => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")} className="rounded-md p-1.5 hover:bg-[var(--paper-deep)]" aria-label={task.is_pinned ? "Desfijar tarea" : "Fijar tarea"}>{task.is_pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
      <button onClick={() => openReminders(task)} title="Configura avisos diarios, mensuales o por fecha límite. El predeterminado se adapta a la fecha." aria-label="Activar recordatorios" className={`rounded-md p-1.5 hover:bg-[var(--paper-deep)] ${task.reminders_enabled ? "text-[#9A7B24]" : ""}`}><BellRing size={17} /></button>
      <button onClick={() => openEdit(task)} className="rounded-md p-1.5 hover:bg-[var(--paper-deep)]" aria-label={`Editar ${task.title}`}><Pencil size={17} /></button>
      <button onClick={() => setDeleteTarget(task)} className="rounded-md p-1.5 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label={`Eliminar ${task.title}`}><Trash2 size={17} /></button>
    </div>
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-display text-2xl font-bold sm:text-3xl">Tareas</h1></div>
      </div>

      <TaskFilters
        search={search}
        status={statusFilter}
        priority={priorityFilter}
        responsible={responsibleFilter}
        deadlineFrom={deadlineFrom}
        deadlineTo={deadlineTo}
        sort={sort}
        pinned={pinnedFilter}
        responsibles={responsibles}
        showResponsible
        showPinned
        viewMode={viewMode}
        onSearch={(value) => { setPage(1); setSearch(value); }}
        onStatus={(value) => { setPage(1); setStatusFilter(value); }}
        onPriority={(value) => { setPage(1); setPriorityFilter(value); }}
        onResponsible={(value) => { setPage(1); setResponsibleFilter(value); }}
        onDeadlineFrom={(value) => { setPage(1); setDeadlineFrom(value); }}
        onDeadlineTo={(value) => { setPage(1); setDeadlineTo(value); }}
        onSort={(value) => { setPage(1); setSort(value); }}
        onPinned={(value) => { setPage(1); setPinnedFilter(value); }}
        onViewMode={setViewMode}
      />

      <ToastMessages success={notice} error={serverError} successAction={noticeAction} onClearSuccess={() => { setNotice(""); setNoticeAction(null); }} onClearError={() => setServerError("")} />
      <div className="mt-6">
        <TaskFolderExplorer folders={folders} selected={folderSelection} searchQuery={search} onSelect={(folder) => { setPage(1); setFolderSelection(folder); }} onCreate={createFolder} onDelete={deleteFolder} onMoveTask={moveTaskToFolder} onMoveFolder={moveFolder} onNewTask={openCreate}>
        {loading ? <div className="col-span-full rounded-lg border border-[var(--line)] bg-[var(--paper-deep)] p-10 text-center text-[var(--ink-soft)]">Cargando tareas...</div> : tasks.length === 0 ? <div className="col-span-full rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-deep)] p-10 text-center text-[var(--ink-soft)]">No hay tareas para estos filtros.</div> : viewMode === "cards" ? (
          <>
            {tasks.map((task) => {
              const overdue = Boolean(task.deadline) && task.status !== "completed" && isBefore(new Date(task.deadline!), new Date());
              const priority = priorityStyles[task.priority];
              return (
                <article key={task.id} draggable onContextMenu={(event) => openTaskMenu(event, task)} onDragStart={(event) => { event.dataTransfer.setData("application/x-taskkeep-task", task.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setPreview(task)} className={`card ${priority.card} cursor-grab p-3.5 active:cursor-grabbing`}>
                  <div className="flex items-start justify-between gap-2"><span className={`shrink-0 ${priority.badge}`}>{priority.label}</span>{actions(task)}</div>
                  <div className="mt-2.5 block w-full text-left"><h2 className="font-display text-base font-bold hover:text-[var(--primary)]">{task.title}</h2>{task.description && <p className="mt-1.5 line-clamp-2 text-xs text-[var(--ink-soft)]">{task.description}</p>}</div>
                  <div className="mt-3 space-y-1.5"><p className={`folio flex items-center gap-2 ${overdue ? "!text-[var(--stamp-red)]" : ""}`}><CalendarClock size={15} />{formatDeadline(task.deadline)}{overdue && " · VENCIDA"}</p><p className="folio">Responsable · {task.responsible?.full_name ?? "Sin nombre"}</p></div>
                  <TaskTimingInfo task={task} compact />
                  <label onClick={(event) => event.stopPropagation()} className="mt-3 block border-t border-[var(--line)] pt-3 text-xs font-bold uppercase tracking-wide">Estado<select value={task.status} onChange={(event) => void patchTask(task, { status: event.target.value as TaskStatus }, "Estado actualizado.")} className="input mt-2 !py-2 text-sm normal-case"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></label>
                </article>
              );
            })}
          </>
        ) : (
          <div className="card col-span-full overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-[var(--paper)] text-xs uppercase text-[var(--ink-soft)]"><tr><th className="px-5 py-4">Tarea</th><th className="px-5 py-4">Responsable</th><th className="px-5 py-4">Fecha límite</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-[var(--line)]">
                {tasks.map((task) => { const priority = priorityStyles[task.priority]; return (
                  <tr key={task.id} draggable onContextMenu={(event) => openTaskMenu(event, task)} onDragStart={(event) => { event.dataTransfer.setData("application/x-taskkeep-task", task.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setPreview(task)} className="cursor-grab hover:bg-[var(--paper)] active:cursor-grabbing">
                    <td className="px-5 py-4"><div className="text-left"><p className="font-bold hover:text-[var(--primary)]">{task.title}</p><span className={`mt-1 inline-block ${priority.badge}`}>{priority.label}</span><TaskTimingInfo task={task} compact /></div></td>
                    <td className="px-5 py-4">{task.responsible?.full_name ?? "Sin nombre"}</td>
                    <td className="folio px-5 py-4">{formatDeadline(task.deadline)}</td>
                    <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}><select value={task.status} onChange={(event) => void patchTask(task, { status: event.target.value as TaskStatus }, "Estado actualizado.")} className={`input !w-auto !px-2 !py-1.5 font-bold ${statusSelectStyles[task.status]}`}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></td>
                    <td className="px-5 py-4"><div className="flex justify-end">{actions(task)}</div></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
        </TaskFolderExplorer>
      </div>
      {total > 12 && <div className="mt-6 flex items-center justify-between"><p className="folio">Página {page} de {Math.ceil(total / 12)} · {total} tareas</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="btn btn-ghost !p-2" aria-label="Página anterior"><ChevronLeft size={19} /></button><button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((value) => value + 1)} className="btn btn-ghost !p-2" aria-label="Página siguiente"><ChevronRight size={19} /></button></div></div>}

      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} task={editing} responsibles={responsibles} initialFolderId={currentFolderId} mode={editorMode} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      {contextMenu && <TaskContextMenu task={contextMenu.task} folders={folders} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onMove={moveContextTask} />}
      <TaskPreviewDialog task={preview} onOpenChange={(open) => !open && setPreview(null)} role="manager" onEdit={openEdit} onTogglePin={(task) => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")} onDelete={(task) => { setPreview(null); setDeleteTarget(task); }} onStatusChange={(task, status) => void patchTask(task, { status }, "Estado actualizado.")} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea" description={`Se eliminará permanentemente "${deleteTarget?.title ?? ""}".`} confirmLabel="Eliminar tarea" onConfirm={async () => { try { await removeTask(); } catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo eliminar la tarea"); } }} />
    </section>
  );
}

function formatDeadline(deadline: string | null) {
  return deadline ? format(new Date(deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite";
}
