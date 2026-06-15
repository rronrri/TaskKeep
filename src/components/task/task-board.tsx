"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog } from "./task-editor-dialog";
import { TaskPreviewDialog } from "./task-preview-dialog";
import { TaskFilters } from "./task-filters";
import type { Task, TaskStatus, UserRole } from "@/types";

const statusLabel: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };

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
  const [preview, setPreview] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");

  const loadTasks = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), size: "12", sort });
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    const response = await fetch(`/api/tasks?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    setTasks(body.data ?? []);
    setTotal(body.pagination?.total ?? 0);
    setPreview((current) => current ? (body.data ?? []).find((task: Task) => task.id === current.id) ?? null : null);
  }, [deadlineFrom, deadlineTo, page, priority, search, sort, status]);

  useEffect(() => {
    // Initial synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadTasks(), fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json())])
      .then(([, me]) => {
        setCurrentUserId(me.user?.id ?? "");
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las tareas"));
  }, [loadTasks]);

  const requestStatus = async (task: Task, requestedStatus: TaskStatus) => {
    const response = await fetch(`/api/tasks/${task.id}/status-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_status: requestedStatus }),
    });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo enviar la solicitud");
    setPreview(null);
    setNotice(`Solicitud enviada para cambiar “${task.title}” a ${statusLabel[requestedStatus].toLowerCase()}.`);
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

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-indigo-600">TABLERO</p><h1 className="font-display text-3xl font-extrabold">Tareas</h1><p className="mt-2 text-slate-600">Consulta tus asignaciones y crea tareas personales sin asignarlas a otras personas.</p></div>
        {role === "collaborator" && <button onClick={() => { setEditing(null); setEditorOpen(true); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white"><Plus size={19} /> Nueva tarea personal</button>}
      </div>
      <TaskFilters search={search} status={status} priority={priority} deadlineFrom={deadlineFrom} deadlineTo={deadlineTo} sort={sort} viewMode={viewMode}
        onSearch={(value) => { setPage(1); setSearch(value); }} onStatus={(value) => { setPage(1); setStatus(value); }}
        onPriority={(value) => { setPage(1); setPriority(value); }} onDeadlineFrom={(value) => { setPage(1); setDeadlineFrom(value); }}
        onDeadlineTo={(value) => { setPage(1); setDeadlineTo(value); }} onSort={(value) => { setPage(1); setSort(value); }} onViewMode={setViewMode} />
      {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      {tasks.length === 0 ? <div className="card p-10 text-center text-slate-500">No hay tareas para este filtro.</div> : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const overdue = Boolean(task.deadline) && task.status !== "completed" && isBefore(new Date(task.deadline!), new Date());
            const style = priorityStyles[task.priority];
            return <article key={task.id} className={`rounded-2xl border p-5 text-left shadow-sm ${style.card}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${style.badge}`}>Prioridad {style.label}</span>
                <div className="flex items-center gap-1">
                  {task.is_pinned && <Pin size={18} aria-label="Tarea fijada" />}
                  {own(task) && <>
                    <button onClick={() => { setEditing(task); setEditorOpen(true); }} title="Configura avisos diarios, mensuales o por fecha límite. Los avisos por fecha se envían 5, 3 y 1 día antes." aria-label="Activar recordatorios" className={`rounded-lg p-2 hover:bg-white/70 ${task.reminders_enabled ? "text-amber-800" : ""}`}><BellRing size={17} /></button>
                    <button onClick={() => { setEditing(task); setEditorOpen(true); }} className="rounded-lg p-2 hover:bg-white/70" aria-label={`Editar ${task.title}`}><Pencil size={17} /></button>
                    <button onClick={() => setDeleteTarget(task)} className="rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label={`Eliminar ${task.title}`}><Trash2 size={17} /></button>
                  </>}
                </div>
              </div>
              <button onClick={() => setPreview(task)} className="block w-full text-left"><h2 className="font-display text-lg font-extrabold">{task.title}</h2>{task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{task.description}</p>}</button>
              <div className="mt-6 space-y-2 text-sm"><p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}><CalendarClock size={17} />{formatDeadline(task.deadline)}{overdue && " · Vencida"}</p>{task.reminders_enabled && <p className="flex items-center gap-2 font-semibold text-amber-800"><BellRing size={16} /> Recordatorios activos</p>}</div>
              <div className="mt-5 border-t border-black/10 pt-4"><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{statusLabel[task.status]}</span></div>
            </article>;
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Tarea</th><th className="px-5 py-4">Fecha límite</th><th className="px-5 py-4">Prioridad</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-200">{tasks.map((task) => { const style = priorityStyles[task.priority]; return <tr key={task.id} className="hover:bg-slate-50"><td onClick={() => setPreview(task)} className="cursor-pointer px-5 py-4 font-bold">{task.title}</td><td className="px-5 py-4">{formatDeadline(task.deadline)}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${style.badge}`}>{style.label}</span></td><td className="px-5 py-4">{statusLabel[task.status]}</td><td className="px-5 py-4"><div className="flex justify-end gap-1">{own(task) && <><button onClick={() => { setEditing(task); setEditorOpen(true); }} title="Configura avisos diarios, mensuales o por fecha límite." aria-label="Activar recordatorios" className="rounded-lg p-2"><BellRing size={17} /></button><button onClick={() => { setEditing(task); setEditorOpen(true); }} className="rounded-lg p-2"><Pencil size={17} /></button><button onClick={() => setDeleteTarget(task)} className="rounded-lg p-2 text-red-700"><Trash2 size={17} /></button></>}</div></td></tr>; })}</tbody></table></div>
      )}
      {total > 12 && <div className="mt-6 flex items-center justify-between"><p className="text-sm text-slate-500">Página {page} de {Math.ceil(total / 12)} · {total} tareas</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft size={19} /></button><button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight size={19} /></button></div></div>}
      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} task={editing} responsibles={[]} actorRole="collaborator" currentUserId={currentUserId} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      <TaskPreviewDialog task={preview} onOpenChange={(open) => !open && setPreview(null)} role={role} onRequestStatus={(task, requestedStatus) => own(task) ? void patchOwnTask(task, { status: requestedStatus }, "Estado actualizado.") : void requestStatus(task, requestedStatus)} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea personal" description={`Se eliminará “${deleteTarget?.title ?? ""}”.`} confirmLabel="Eliminar tarea" onConfirm={removeOwnTask} />
    </section>
  );
}

function formatDeadline(deadline: string | null) {
  return deadline ? format(new Date(deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite";
}
