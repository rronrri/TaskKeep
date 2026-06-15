"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { CalendarDays, Pin } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog, type ResponsibleOption } from "@/components/task/task-editor-dialog";
import { TaskPreviewDialog } from "@/components/task/task-preview-dialog";
import type { SessionUser, Task, TaskStatus } from "@/types";

export function TaskCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [responsibles, setResponsibles] = useState<ResponsibleOption[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/tasks?size=100", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    setTasks(body.data ?? []);
    setPreview((current) => current ? (body.data ?? []).find((task: Task) => task.id === current.id) ?? null : null);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks?size=100", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ])
      .then(async ([tasksResponse, meResponse]) => {
        const tasksBody = await tasksResponse.json();
        const meBody = await meResponse.json();
        if (!tasksResponse.ok) throw new Error(tasksBody.error ?? "No se pudieron cargar las tareas");
        if (!meResponse.ok) throw new Error(meBody.error ?? "No se pudo cargar la sesión");
        setTasks(tasksBody.data ?? []);
        setSession(meBody.user);
        if (meBody.user.role === "manager") {
          const usersResponse = await fetch("/api/admin/users", { cache: "no-store" });
          const usersBody = await usersResponse.json();
          if (!usersResponse.ok) throw new Error(usersBody.error ?? "No se pudieron cargar los responsables");
          setResponsibles([
            { id: meBody.user.id, full_name: `${meBody.user.fullName} (yo)`, role: "manager" },
            ...(usersBody.data ?? []).filter((user: ResponsibleOption) => user.id !== meBody.user.id),
          ]);
        }
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudo cargar el calendario"));
  }, []);

  const events = useMemo(() => tasks.filter((task) => task.deadline).map((task) => ({
    id: task.id,
    title: task.title,
    date: task.deadline!.slice(0, 10),
    color: priorityStyles[task.priority].calendar,
  })), [tasks]);

  const selectedTasks = useMemo(() => tasks.filter((task) => task.deadline?.slice(0, 10) === selectedDate), [selectedDate, tasks]);

  const patchTask = async (task: Task, values: Partial<Pick<Task, "is_pinned" | "status">>, message: string) => {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const body = await response.json();
    if (!response.ok) { setServerError(body.error ?? "No se pudo actualizar la tarea"); return; }
    setNotice(message);
    await loadTasks();
  };

  const requestStatus = async (task: Task, requestedStatus: TaskStatus) => {
    const response = await fetch(`/api/tasks/${task.id}/status-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requested_status: requestedStatus }) });
    const body = await response.json();
    if (!response.ok) { setServerError(body.error ?? "No se pudo enviar la solicitud"); return; }
    setPreview(null);
    setNotice("Solicitud de cambio de estado enviada.");
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

  const openEdit = (task: Task) => {
    setPreview(null);
    setEditing(task);
    setEditorOpen(true);
  };

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">PLANIFICACIÓN</p>
      <h1 className="font-display text-3xl font-extrabold">Calendario</h1>
      <p className="mt-2 text-slate-600">Selecciona un día para previsualizar sus tareas o pulsa un evento para abrirlo.</p>
      {serverError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden p-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            events={events}
            height="auto"
            dayMaxEvents={3}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            eventClick={(info) => {
              const task = tasks.find((candidate) => candidate.id === info.event.id);
              if (task) setPreview(task);
            }}
          />
        </div>
        <aside className="card h-fit p-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-100 p-2 text-indigo-700"><CalendarDays size={20} /></span><div><p className="text-xs font-bold uppercase text-slate-500">Vista previa</p><h2 className="font-display font-extrabold">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</h2></div></div>
          <div className="mt-4 space-y-3">
            {selectedTasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay tareas para este día.</p> : selectedTasks.map((task) => {
              const priority = priorityStyles[task.priority];
              return (
                <button key={task.id} onClick={() => setPreview(task)} className={`w-full rounded-xl border p-3 text-left hover:shadow-sm ${priority.card}`}>
                  <div className="flex items-start justify-between gap-2"><p className="font-bold">{task.title}</p>{task.is_pinned && <Pin size={15} />}</div>
                  <p className="mt-1 text-xs text-slate-600">{new Date(task.deadline!).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} · {task.responsible?.full_name ?? "Responsable"}</p>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <TaskPreviewDialog
        task={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        role={session?.role === "manager" ? "manager" : "collaborator"}
        onEdit={openEdit}
        onTogglePin={(task) => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")}
        onDelete={(task) => { setPreview(null); setDeleteTarget(task); }}
        onStatusChange={(task, status) => void patchTask(task, { status }, "Estado actualizado.")}
        onRequestStatus={(task, status) => void requestStatus(task, status)}
      />
      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} task={editing} responsibles={responsibles} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea" description={`Se eliminará permanentemente “${deleteTarget?.title ?? ""}”.`} confirmLabel="Eliminar tarea" onConfirm={async () => { try { await removeTask(); } catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo eliminar la tarea"); } }} />
    </section>
  );
}
