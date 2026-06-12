"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskPreviewDialog } from "./task-preview-dialog";
import { TaskFilters } from "./task-filters";
import type { Task, TaskStatus, UserRole } from "@/types";

const statusLabel: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };

export function TaskBoard({ role }: { role: UserRole }) {
  const [tasks, setTasks] = useState<Task[]>([]);
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
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), size: "12", sort });
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (search.trim()) query.set("q", search.trim());
    if (deadlineFrom) query.set("deadline_from", deadlineFrom);
    if (deadlineTo) query.set("deadline_to", deadlineTo);
    fetch(`/api/tasks?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
        setTasks(body.data ?? []);
        setTotal(body.pagination?.total ?? 0);
        const requestedTask = new URLSearchParams(window.location.search).get("task");
        if (requestedTask) setPreview((body.data ?? []).find((task: Task) => task.id === requestedTask) ?? null);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las tareas"));
  }, [deadlineFrom, deadlineTo, page, priority, search, sort, status]);

  const requestStatus = async (task: Task, requestedStatus: TaskStatus) => {
    setNotice("");
    setServerError("");
    const response = await fetch(`/api/tasks/${task.id}/status-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requested_status: requestedStatus }),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo enviar la solicitud");
      return;
    }
    setPreview(null);
    setNotice(`Solicitud enviada para cambiar “${task.title}” a ${statusLabel[requestedStatus].toLowerCase()}.`);
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-indigo-600">TABLERO</p><h1 className="font-display text-3xl font-extrabold">Tareas</h1></div>
      </div>
      <TaskFilters
        search={search}
        status={status}
        priority={priority}
        deadlineFrom={deadlineFrom}
        deadlineTo={deadlineTo}
        sort={sort}
        viewMode={viewMode}
        onSearch={(value) => { setPage(1); setSearch(value); }}
        onStatus={(value) => { setPage(1); setStatus(value); }}
        onPriority={(value) => { setPage(1); setPriority(value); }}
        onDeadlineFrom={(value) => { setPage(1); setDeadlineFrom(value); }}
        onDeadlineTo={(value) => { setPage(1); setDeadlineTo(value); }}
        onSort={(value) => { setPage(1); setSort(value); }}
        onViewMode={setViewMode}
      />
      {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      {tasks.length === 0 ? <div className="card p-10 text-center text-slate-500">No hay tareas para este filtro.</div> : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const overdue = task.status !== "completed" && isBefore(new Date(task.deadline), new Date());
            const priority = priorityStyles[task.priority];
            return (
              <button key={task.id} onClick={() => setPreview(task)} className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${priority.card}`}>
                <div className="mb-4 flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${priority.badge}`}>Prioridad {priority.label}</span>{task.is_pinned && <Pin size={18} aria-label="Tarea fijada" />}</div>
                <h2 className="font-display text-lg font-extrabold">{task.title}</h2>
                {task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{task.description}</p>}
                <div className="mt-6 space-y-2 text-sm"><p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}><CalendarClock size={17} />{format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es })}{overdue && " · Vencida"}</p><p>{task.responsible?.full_name ?? "Responsable asignado"}</p></div>
                <div className="mt-5 border-t border-black/10 pt-4"><span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{statusLabel[task.status]}</span></div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Tarea</th><th className="px-5 py-4">Fecha límite</th><th className="px-5 py-4">Prioridad</th><th className="px-5 py-4">Estado</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {tasks.map((task) => { const priority = priorityStyles[task.priority]; return (
                <tr key={task.id} onClick={() => setPreview(task)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-5 py-4"><p className="font-bold">{task.title}</p>{task.is_pinned && <span className="mt-1 flex items-center gap-1 text-xs"><Pin size={13} /> Fijada</span>}</td>
                  <td className="px-5 py-4">{format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es })}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${priority.badge}`}>{priority.label}</span></td>
                  <td className="px-5 py-4">{statusLabel[task.status]}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
      {total > 12 && <div className="mt-6 flex items-center justify-between"><p className="text-sm text-slate-500">Página {page} de {Math.ceil(total / 12)} · {total} tareas</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={19} /></button><button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={19} /></button></div></div>}
      <TaskPreviewDialog task={preview} onOpenChange={(open) => !open && setPreview(null)} role={role} onRequestStatus={(task, requestedStatus) => void requestStatus(task, requestedStatus)} />
    </section>
  );
}
