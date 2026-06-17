"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog, type ResponsibleOption } from "./task-editor-dialog";
import { TaskPreviewDialog } from "./task-preview-dialog";
import { TaskFilters } from "./task-filters";
import type { Task, TaskStatus } from "@/types";

interface Responsible extends ResponsibleOption { email: string; }

export function ManagerTaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [preview, setPreview] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
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

  const loadTasks = useCallback(async () => {
    const query = new URLSearchParams({ size: "12", page: String(page), sort });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    if (responsibleFilter) query.set("responsible_id", responsibleFilter);
    if (pinnedFilter) query.set("pinned", "true");
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    const response = await fetch(`/api/tasks?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    setTasks(body.data ?? []);
    setTotal(body.pagination?.total ?? 0);
    setPreview((current) => current ? (body.data ?? []).find((task: Task) => task.id === current.id) ?? null : null);
  }, [deadlineFrom, deadlineTo, page, pinnedFilter, priorityFilter, responsibleFilter, search, sort, statusFilter]);

  useEffect(() => {
    const query = new URLSearchParams({ size: "12", page: String(page), sort });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    if (responsibleFilter) query.set("responsible_id", responsibleFilter);
    if (pinnedFilter) query.set("pinned", "true");
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    Promise.all([
      fetch(`/api/tasks?${query}`, { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ])
      .then(async ([tasksResponse, usersResponse, meResponse]) => {
        const tasksBody = await tasksResponse.json();
        const usersBody = await usersResponse.json();
        const meBody = await meResponse.json();
        if (!tasksResponse.ok) throw new Error(tasksBody.error ?? "No se pudieron cargar las tareas");
        if (!usersResponse.ok) throw new Error(usersBody.error ?? "No se pudieron cargar los responsables");
        if (!meResponse.ok) throw new Error(meBody.error ?? "No se pudo cargar la sesión");
        setTasks(tasksBody.data ?? []);
        setTotal(tasksBody.pagination?.total ?? 0);
        const requestedTask = new URLSearchParams(window.location.search).get("task");
        if (requestedTask) setPreview((tasksBody.data ?? []).find((task: Task) => task.id === requestedTask) ?? null);
        setResponsibles([
          { id: meBody.user.id, full_name: `${meBody.user.fullName} (yo)`, email: meBody.user.email, role: "manager" },
          ...(usersBody.data ?? []).filter((user: Responsible) => user.id !== meBody.user.id),
        ]);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [deadlineFrom, deadlineTo, page, pinnedFilter, priorityFilter, responsibleFilter, search, sort, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setPreview(null);
    setEditing(task);
    setEditorOpen(true);
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
    <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
      <button onClick={() => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")} className="rounded-lg p-2 hover:bg-white/70" aria-label={task.is_pinned ? "Desfijar tarea" : "Fijar tarea"}>{task.is_pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
      <button
        onClick={() => openEdit(task)}
        title="Configura avisos diarios, mensuales o por fecha límite. El predeterminado se adapta a la fecha."
        aria-label="Activar recordatorios"
        className={`rounded-lg p-2 hover:bg-white/70 ${task.reminders_enabled ? "text-amber-800" : ""}`}
      >
        <BellRing size={17} />
      </button>
      <button onClick={() => openEdit(task)} className="rounded-lg p-2 hover:bg-white/70" aria-label={`Editar ${task.title}`}><Pencil size={17} /></button>
      <button onClick={() => setDeleteTarget(task)} className="rounded-lg p-2 text-red-700 hover:bg-red-50/70" aria-label={`Eliminar ${task.title}`}><Trash2 size={17} /></button>
    </div>
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-indigo-600">TABLERO</p><h1 className="font-display text-3xl font-extrabold">Tareas</h1><p className="mt-2 text-slate-600">Crea, asigna y controla el trabajo de tu empresa.</p></div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"><Plus size={19} /> Nueva tarea</button>
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

      {serverError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      <div className="mt-6">
        {loading ? <div className="card p-10 text-center text-slate-500">Cargando tareas...</div> : tasks.length === 0 ? <div className="card p-10 text-center text-slate-500">No hay tareas para estos filtros.</div> : viewMode === "cards" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tasks.map((task) => {
              const overdue = Boolean(task.deadline) && task.status !== "completed" && isBefore(new Date(task.deadline!), new Date());
              const priority = priorityStyles[task.priority];
              return (
                <article key={task.id} onClick={() => setPreview(task)} className={`cursor-pointer rounded-2xl border p-5 shadow-sm ${priority.card}`}>
                  <div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${priority.badge}`}>Prioridad {priority.label}</span>{actions(task)}</div>
                  <div className="mt-4 block w-full text-left"><h2 className="font-display text-lg font-extrabold hover:text-indigo-700">{task.title}</h2>{task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{task.description}</p>}</div>
                  <div className="mt-5 space-y-2 text-sm"><p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}><CalendarClock size={17} />{formatDeadline(task.deadline)}{overdue && " · Vencida"}</p><p>Responsable: <strong>{task.responsible?.full_name ?? "Sin nombre"}</strong></p></div>
                  <label onClick={(event) => event.stopPropagation()} className="mt-5 block border-t border-black/10 pt-4 text-xs font-bold uppercase tracking-wide">Estado<select value={task.status} onChange={(event) => void patchTask(task, { status: event.target.value as TaskStatus }, "Estado actualizado.")} className="mt-2 w-full rounded-lg border border-black/15 bg-white/75 px-3 py-2 text-sm normal-case"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></label>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Tarea</th><th className="px-5 py-4">Responsable</th><th className="px-5 py-4">Fecha límite</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {tasks.map((task) => { const priority = priorityStyles[task.priority]; return (
                  <tr key={task.id} onClick={() => setPreview(task)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-4"><div className="text-left"><p className="font-bold hover:text-indigo-700">{task.title}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${priority.badge}`}>{priority.label}</span></div></td>
                    <td className="px-5 py-4">{task.responsible?.full_name ?? "Sin nombre"}</td>
                    <td className="px-5 py-4">{formatDeadline(task.deadline)}</td>
                    <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}><select value={task.status} onChange={(event) => void patchTask(task, { status: event.target.value as TaskStatus }, "Estado actualizado.")} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option></select></td>
                    <td className="px-5 py-4"><div className="flex justify-end">{actions(task)}</div></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > 12 && <div className="mt-6 flex items-center justify-between"><p className="text-sm text-slate-500">Página {page} de {Math.ceil(total / 12)} · {total} tareas</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={19} /></button><button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={19} /></button></div></div>}

      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} task={editing} responsibles={responsibles} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      <TaskPreviewDialog task={preview} onOpenChange={(open) => !open && setPreview(null)} role="manager" onEdit={openEdit} onTogglePin={(task) => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")} onDelete={(task) => { setPreview(null); setDeleteTarget(task); }} onStatusChange={(task, status) => void patchTask(task, { status }, "Estado actualizado.")} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea" description={`Se eliminará permanentemente “${deleteTarget?.title ?? ""}”.`} confirmLabel="Eliminar tarea" onConfirm={async () => { try { await removeTask(); } catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo eliminar la tarea"); } }} />
    </section>
  );
}

function formatDeadline(deadline: string | null) {
  return deadline ? format(new Date(deadline), "d MMM yyyy, HH:mm", { locale: es }) : "Sin fecha límite";
}
