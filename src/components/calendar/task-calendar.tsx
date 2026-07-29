"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastMessages } from "@/components/ui/toast-message";
import { priorityStyles } from "@/lib/tasks/priority-style";
import { TaskEditorDialog, type ResponsibleOption } from "@/components/task/task-editor-dialog";
import { TaskPreviewDialog } from "@/components/task/task-preview-dialog";
import type { SessionUser, Task, TaskStatus } from "@/types";

type CalendarTaskEvent = {
  id: string;
  title: string;
  start: string;
  color: string;
  textColor: string;
  taskId: string;
  kind: "reminder" | "deadline";
};

export function TaskCalendar() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [responsibles, setResponsibles] = useState<ResponsibleOption[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [preview, setPreview] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [visibleRange, setVisibleRange] = useState(() => monthRange(new Date()));
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false);
  const [returnToRecurring, setReturnToRecurring] = useState(false);

  const loadTasks = useCallback(async () => {
    const allTasks = await fetchCalendarTasks();
    setTasks(allTasks);
    setPreview((current) => current ? allTasks.find((task) => task.id === current.id) ?? null : null);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchCalendarTasks(),
      fetch("/api/auth/me", { cache: "no-store" }),
    ])
      .then(async ([allTasks, meResponse]) => {
        const meBody = await meResponse.json();
        if (!meResponse.ok) throw new Error(meBody.error ?? "No se pudo cargar la sesión");
        setTasks(allTasks);
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

  const events = useMemo(
    () => buildCalendarEvents(tasks, visibleRange.start, visibleRange.end),
    [tasks, visibleRange],
  );

  const selectedEvents = useMemo(
    () => [
      ...events.filter((event) => localDateKey(new Date(event.start)) === selectedDate),
      ...buildRecurringEventsForDate(tasks, selectedDate),
    ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, selectedDate, tasks],
  );
  const recurringTasks = useMemo(
    () => tasks.filter((task) => task.reminders_enabled && (task.reminder_mode === "daily" || task.reminder_mode === "monthly") && task.status !== "completed"),
    [tasks],
  );

  const moveCalendar = (direction: "prev" | "next" | "today") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[direction]();
    setSelectedDate(localDateKey(api.getDate()));
  };

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

  const openRecurringTask = (task: Task) => {
    setRecurringModalOpen(false);
    setReturnToRecurring(true);
    setPreview(task);
  };

  const closeTaskPreview = (open: boolean) => {
    if (open) return;
    setPreview(null);
    if (returnToRecurring) setRecurringModalOpen(true);
  };

  const changeEditorOpen = (open: boolean) => {
    setEditorOpen(open);
    if (!open && returnToRecurring) setRecurringModalOpen(true);
  };

  return (
    <section>
      <p className="folio !text-[var(--primary)]">PLANIFICACIÓN</p>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Calendario</h1>
      <p className="mt-2 text-[var(--ink-soft)]">Selecciona un día para previsualizar sus tareas o pulsa un evento para abrirlo.</p>
      <ToastMessages success={notice} error={serverError} onClearSuccess={() => setNotice("")} onClearError={() => setServerError("")} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <h2 className="font-display text-xl font-bold capitalize">{calendarTitle}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => moveCalendar("today")} className="btn btn-ghost !px-3 !py-2 text-sm">Hoy</button>
              <button type="button" onClick={() => moveCalendar("prev")} className="btn btn-ghost !p-2.5" aria-label="Mes anterior"><ChevronLeft size={19} /></button>
              <button type="button" onClick={() => moveCalendar("next")} className="btn btn-ghost !p-2.5" aria-label="Mes siguiente"><ChevronRight size={19} /></button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-4 text-xs font-semibold text-[var(--ink-soft)]">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" /> Fechas límite</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#9A7B24]" /> Avisos puntuales</span>
            <span className="text-[var(--line-strong)]">Los recordatorios recurrentes están resumidos a la derecha.</span>
          </div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            events={events}
            headerToolbar={false}
            height="auto"
            dayMaxEvents={2}
            displayEventTime
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            datesSet={(info) => {
              setCalendarTitle(info.view.title);
              setVisibleRange({ start: info.start, end: info.end });
            }}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            eventClick={(info) => {
              const task = tasks.find((candidate) => candidate.id === info.event.extendedProps.taskId);
              if (task) setPreview(task);
            }}
          />
        </div>
        <aside className="card h-fit p-5">
          <div className="flex items-center gap-3"><span className="rounded-md bg-[var(--primary-wash)] p-2 text-[var(--primary)]"><CalendarDays size={20} /></span><div><p className="folio uppercase">Vista previa</p><h2 className="font-display font-bold">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</h2></div></div>
          {recurringTasks.length > 0 && (
            <button type="button" onClick={() => setRecurringModalOpen(true)} className="mt-5 flex w-full items-center gap-3 rounded-md border border-[#d9c98f] bg-[#F3EDDC] p-4 text-left hover:border-[#9A7B24]">
              <span className="rounded-md bg-[var(--surface)] p-2 text-[#9A7B24]"><BellRing size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase text-[#6b5619]">Recordatorios recurrentes</span><span className="mt-1 block text-sm text-[var(--ink)]">{recurringTasks.length} {recurringTasks.length === 1 ? "recordatorio activo" : "recordatorios activos"}</span></span>
              <Eye className="shrink-0 text-[#6b5619]" size={20} aria-hidden="true" />
            </button>
          )}
          <p className="folio mt-5 uppercase">En este día</p>
          {selectedEvents.length === 0 ? <p className="mt-4 rounded-md bg-[var(--paper)] p-4 text-sm text-[var(--ink-soft)]">No hay tareas ni recordatorios para este día.</p> : (
            <button type="button" onClick={() => setDayEventsModalOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-md border border-[var(--primary)] bg-[var(--primary-wash)] p-4 text-left hover:border-[var(--primary-strong)]">
              <span className="rounded-md bg-[var(--surface)] p-2 text-[var(--primary)]"><CalendarDays size={19} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase text-[var(--primary)]">Actividad del día</span><span className="mt-1 block text-sm text-[var(--ink)]">{selectedEvents.length} {selectedEvents.length === 1 ? "elemento" : "elementos"}</span></span>
              <Eye className="shrink-0 text-[var(--primary)]" size={20} aria-hidden="true" />
            </button>
          )}
        </aside>
      </div>

      <AppDialog open={dayEventsModalOpen} onOpenChange={setDayEventsModalOpen} title="Actividad del dia" description={new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })} size="lg" scrollable={false}>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_auto] gap-4 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] md:grid">
            <span>Tarea</span><span>Tipo y hora</span><span>Responsable</span><span>Prioridad</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {selectedEvents.map((event) => {
              const task = tasks.find((candidate) => candidate.id === event.taskId);
              if (!task) return null;
              const priority = priorityStyles[task.priority];
              const isReminder = event.kind === "reminder";
              return (
                <button key={event.id} type="button" onClick={() => { setDayEventsModalOpen(false); setPreview(task); }} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-[var(--paper)] md:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_auto] md:items-center md:gap-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`rounded-md p-2 ${isReminder ? "bg-[#F3EDDC] text-[#9A7B24]" : "bg-[var(--primary-wash)] text-[var(--primary)]"}`}>{isReminder ? <BellRing size={17} /> : <CalendarDays size={17} />}</span>
                    <span className="min-w-0"><span className="block truncate font-bold text-[var(--ink)]">{task.title}</span><span className="mt-0.5 block truncate text-xs text-[var(--ink-soft)]">Abrir detalle de la tarea</span></span>
                  </span>
                  <span className={`text-sm font-semibold ${isReminder ? "text-[#6b5619]" : "text-[var(--primary)]"}`}>{isReminder ? "Recordatorio" : "Fecha limite"} · {new Date(event.start).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="truncate text-sm text-[var(--ink-soft)]">{task.responsible?.full_name ?? "Sin nombre"}</span>
                  <span className={`w-fit ${priority.badge}`}>{priority.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </AppDialog>

      <AppDialog open={recurringModalOpen} onOpenChange={(open) => { setRecurringModalOpen(open); if (!open && !preview && !editorOpen) setReturnToRecurring(false); }} title="Recordatorios recurrentes" description="Consulta todos los avisos diarios y mensuales activos. Pulsa uno para abrir la tarea." size="lg" scrollable={false}>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_auto] gap-4 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)] md:grid">
            <span>Tarea</span><span>Frecuencia</span><span>Responsable</span><span>Prioridad</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
          {recurringTasks.map((task) => {
            const priority = priorityStyles[task.priority];
            return (
              <button key={task.id} type="button" onClick={() => openRecurringTask(task)} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-[var(--paper)] md:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_auto] md:items-center md:gap-4">
                <span className="flex min-w-0 items-center gap-3"><span className="rounded-md bg-[#F3EDDC] p-2 text-[#9A7B24]"><BellRing size={17} /></span><span className="min-w-0"><span className="block truncate font-bold text-[var(--ink)]">{task.title}</span><span className="mt-0.5 block truncate text-xs text-[var(--ink-soft)]">Abrir detalle de la tarea</span></span></span>
                <span className="text-sm font-semibold text-[#6b5619]">{recurringLabel(task)}</span>
                <span className="truncate text-sm text-[var(--ink-soft)]">{task.responsible?.full_name ?? "Sin nombre"}</span>
                <span className={`w-fit ${priority.badge}`}>{priority.label}</span>
              </button>
            );
          })}
          </div>
        </div>
      </AppDialog>

      <TaskPreviewDialog
        task={preview}
        onOpenChange={closeTaskPreview}
        role={session?.role === "manager" ? "manager" : "collaborator"}
        onEdit={openEdit}
        onTogglePin={(task) => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")}
        onDelete={(task) => { setPreview(null); setDeleteTarget(task); }}
        onStatusChange={(task, status) => void patchTask(task, { status }, "Estado actualizado.")}
        onRequestStatus={(task, status) => void requestStatus(task, status)}
      />
      <TaskEditorDialog open={editorOpen} onOpenChange={changeEditorOpen} task={editing} responsibles={responsibles} onSaved={async (message) => { setNotice(message); await loadTasks(); }} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Eliminar tarea" description={`Se eliminará permanentemente “${deleteTarget?.title ?? ""}”.`} confirmLabel="Eliminar tarea" onConfirm={async () => { try { await removeTask(); } catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo eliminar la tarea"); } }} />
    </section>
  );
}

async function fetchCalendarTasks() {
  const firstResponse = await fetch("/api/tasks?size=50&page=1&sort=deadline_asc", { cache: "no-store" });
  const firstBody = await firstResponse.json();
  if (!firstResponse.ok) throw new Error(firstBody.error ?? "No se pudieron cargar las tareas");
  const total = Number(firstBody.pagination?.total ?? 0);
  const pages = Math.ceil(total / 50);
  if (pages <= 1) return (firstBody.data ?? []) as Task[];
  const remaining = await Promise.all(Array.from({ length: pages - 1 }, async (_, index) => {
    const response = await fetch(`/api/tasks?size=50&page=${index + 2}&sort=deadline_asc`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    return (body.data ?? []) as Task[];
  }));
  return [...(firstBody.data ?? []), ...remaining.flat()] as Task[];
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(date: Date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

function buildCalendarEvents(tasks: Task[], rangeStart: Date, rangeEnd: Date) {
  const events: CalendarTaskEvent[] = [];
  for (const task of tasks) {
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      if (insideRange(deadline, rangeStart, rangeEnd)) {
        events.push(calendarEvent(task, deadline, "deadline"));
      }
    }
    if (!task.reminders_enabled || task.reminder_mode === "none" || task.status === "completed") continue;

    if (task.reminder_mode === "deadline" && task.deadline) {
      const deadline = new Date(task.deadline).getTime();
      for (const minutes of task.reminder_settings?.deadline_offsets ?? []) {
        const occurrence = new Date(deadline - minutes * 60_000);
        if (occurrence >= new Date(task.created_at) && insideRange(occurrence, rangeStart, rangeEnd)) {
          events.push(calendarEvent(task, occurrence, "reminder"));
        }
      }
    }
  }
  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function buildRecurringEventsForDate(tasks: Task[], dateKey: string) {
  const [year, monthValue, day] = dateKey.split("-").map(Number);
  const month = monthValue - 1;
  return tasks.flatMap((task) => {
    if (!task.reminders_enabled || task.status === "completed" || (task.reminder_mode !== "daily" && task.reminder_mode !== "monthly")) return [];
    if (task.reminder_mode === "monthly" && day !== clampDay(year, month, task.reminder_settings?.monthly_day ?? 1)) return [];
    const [hour, minute] = (task.reminder_settings?.recurring_time ?? "09:00").split(":").map(Number);
    const occurrence = localToUtc(year, month, day, hour, minute, task.reminder_settings?.timezone_offset_minutes ?? 0);
    if (occurrence < new Date(task.created_at)) return [];
    return [calendarEvent(task, occurrence, "reminder")];
  });
}

function recurringLabel(task: Task) {
  const time = task.reminder_settings?.recurring_time ?? "09:00";
  return task.reminder_mode === "daily"
    ? `Todos los días · ${time}`
    : `Día ${task.reminder_settings?.monthly_day ?? 1} de cada mes · ${time}`;
}

function calendarEvent(task: Task, date: Date, kind: "reminder" | "deadline"): CalendarTaskEvent {
  return {
    id: `${task.id}:${kind}:${date.getTime()}`,
    title: `${kind === "reminder" ? "Recordatorio" : "Fecha límite"}: ${task.title}`,
    start: date.toISOString(),
    color: kind === "reminder" ? "#9a7b24" : priorityStyles[task.priority].calendar,
    textColor: "#ffffff",
    taskId: task.id,
    kind,
  };
}

function localToUtc(year: number, month: number, day: number, hour: number, minute: number, offset: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) + offset * 60_000);
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(Math.max(day, 1), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
}

function insideRange(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}
