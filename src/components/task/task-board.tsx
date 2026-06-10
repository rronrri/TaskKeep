"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Paperclip, Pin } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import type { Task, TaskStatus, UserRole } from "@/types";

const statusLabel = { pending: "Pendiente", in_progress: "En curso", completed: "Completada" };
const priorityLabel = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };

export function TaskBoard({ role }: { role: UserRole }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  useEffect(() => {
    fetch(`/api/tasks${status ? `?status=${status}` : ""}`)
      .then((response) => response.json())
      .then((body) => setTasks(body.data ?? []));
  }, [status]);

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
    setNotice(`Solicitud enviada para cambiar "${task.title}" a ${statusLabel[requestedStatus].toLowerCase()}.`);
  };
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-indigo-600">TABLERO</p><h1 className="font-display text-3xl font-extrabold">Tareas</h1></div>
        <label className="text-sm font-semibold">Filtrar por estado
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">Todos</option><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option>
          </select>
        </label>
      </div>
      {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      {tasks.length === 0 && <div className="card p-10 text-center text-slate-500">No hay tareas para este filtro.</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => {
          const overdue = task.status !== "completed" && isBefore(new Date(task.deadline), new Date());
          return (
            <article key={task.id} className="rounded-2xl border border-black/10 p-5 shadow-sm" style={{ backgroundColor: task.color ?? "#fff7cc" }}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-extrabold">{priorityLabel[task.priority]}</span>
                {task.is_pinned && <Pin size={18} aria-label="Tarea fijada" />}
              </div>
              <h2 className="font-display text-lg font-extrabold">{task.title}</h2>
              {task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{task.description}</p>}
              <div className="mt-6 space-y-2 text-sm">
                <p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}><CalendarClock size={17} />{format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es })}{overdue && " · Vencida"}</p>
                <p>{task.responsible?.full_name ?? "Responsable asignado"}</p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{statusLabel[task.status]}</span>
                <Paperclip size={17} aria-label="Archivos adjuntos" />
              </div>
              {role === "collaborator" && (
                <label className="mt-4 block text-xs font-bold uppercase tracking-wide">
                  Solicitar cambio de estado
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value) void requestStatus(task, event.target.value as TaskStatus);
                      event.target.value = "";
                    }}
                    className="mt-2 w-full rounded-lg border border-black/15 bg-white/80 px-3 py-2 text-sm normal-case"
                  >
                    <option value="">Selecciona un estado</option>
                    {(["pending", "in_progress", "completed"] as TaskStatus[])
                      .filter((candidate) => candidate !== task.status)
                      .map((candidate) => <option key={candidate} value={candidate}>{statusLabel[candidate]}</option>)}
                  </select>
                </label>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
