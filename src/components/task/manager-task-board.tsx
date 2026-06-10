"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { format, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Task, TaskStatus } from "@/types";

const formSchema = z.object({
  title: z.string().trim().min(2, "Ingresa un título").max(160),
  description: z.string().trim().max(5000),
  responsible_id: z.string().uuid("Selecciona un responsable"),
  deadline: z.string().min(1, "Selecciona una fecha límite"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pending", "in_progress", "completed"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  is_pinned: z.boolean(),
});

type TaskInput = z.infer<typeof formSchema>;

interface Responsible {
  id: string;
  full_name: string;
  email: string;
  role: "manager" | "collaborator";
}

const defaults: TaskInput = {
  title: "",
  description: "",
  responsible_id: "",
  deadline: "",
  priority: "medium",
  status: "pending",
  color: "#fff7cc",
  is_pinned: false,
};

const priorityLabel = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export function ManagerTaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskInput>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  const loadTasks = async () => {
    const query = new URLSearchParams({ size: "50" });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
    const response = await fetch(`/api/tasks?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las tareas");
    setTasks(body.data ?? []);
  };

  useEffect(() => {
    const query = new URLSearchParams({ size: "50" });
    if (statusFilter) query.set("status", statusFilter);
    if (priorityFilter) query.set("priority", priorityFilter);
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
        setResponsibles([
          {
            id: meBody.user.id,
            full_name: `${meBody.user.fullName} (yo)`,
            email: meBody.user.email,
            role: "manager",
          },
          ...(usersBody.data ?? []).filter((user: Responsible) => user.id !== meBody.user.id),
        ]);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [priorityFilter, statusFilter]);

  const submit = async (values: TaskInput) => {
    setServerError("");
    setNotice("");
    const payload = {
      ...values,
      description: values.description || null,
      deadline: new Date(values.deadline).toISOString(),
    };
    const response = await fetch(editing ? `/api/tasks/${editing.id}` : "/api/tasks", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo guardar la tarea");
      return;
    }
    setNotice(editing ? "Tarea actualizada correctamente." : "Tarea creada correctamente.");
    setEditing(null);
    reset(defaults);
    await loadTasks();
  };

  const startEditing = (task: Task) => {
    setEditing(task);
    setServerError("");
    setNotice("");
    reset({
      title: task.title,
      description: task.description ?? "",
      responsible_id: task.responsible_id,
      deadline: toLocalDateTime(task.deadline),
      priority: task.priority,
      status: task.status,
      color: task.color ?? "#fff7cc",
      is_pinned: task.is_pinned,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditing = () => {
    setEditing(null);
    reset(defaults);
  };

  const patchTask = async (task: Task, values: Partial<TaskInput>, success: string) => {
    setServerError("");
    setNotice("");
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

  const removeTask = async (task: Task) => {
    if (!window.confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo eliminar la tarea");
    if (editing?.id === task.id) cancelEditing();
    setNotice("Tarea eliminada correctamente.");
    await loadTasks();
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-indigo-600">TABLERO</p>
          <h1 className="font-display text-3xl font-extrabold">Tareas</h1>
          <p className="mt-2 text-slate-600">Crea, asigna y controla el trabajo de tu empresa.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-semibold">
            Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En curso</option>
              <option value="completed">Completada</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Prioridad
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Todas</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[400px_1fr]">
        <form onSubmit={handleSubmit(submit)} className="card h-fit p-6" noValidate>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-3 font-display text-xl font-extrabold">
              <span className="rounded-xl bg-indigo-100 p-2 text-indigo-700">{editing ? <Pencil size={20} /> : <Plus size={20} />}</span>
              {editing ? "Editar tarea" : "Nueva tarea"}
            </h2>
            {editing && <button type="button" onClick={cancelEditing} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Cancelar edición"><X size={20} /></button>}
          </div>

          <div className="space-y-4">
            <Field label="Título" error={errors.title?.message}>
              <input {...register("title")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Ej. Preparar informe mensual" />
            </Field>
            <Field label="Descripción" error={errors.description?.message}>
              <textarea {...register("description")} rows={4} className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5" />
            </Field>
            <Field label="Responsable" error={errors.responsible_id?.message}>
              <select {...register("responsible_id")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                <option value="">Selecciona una persona</option>
                {responsibles.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.role === "manager" ? "Gestora" : "Colaboradora"}</option>)}
              </select>
            </Field>
            <Field label="Fecha límite" error={errors.deadline?.message}>
              <input type="datetime-local" {...register("deadline")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prioridad" error={errors.priority?.message}>
                <select {...register("priority")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                  <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                </select>
              </Field>
              <Field label="Estado" error={errors.status?.message}>
                <select {...register("status")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                  <option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-4">
              <Field label="Color" error={errors.color?.message}>
                <input type="color" {...register("color")} className="h-11 w-full rounded-xl border border-slate-300 bg-white p-1" />
              </Field>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold">
                <input type="checkbox" {...register("is_pinned")} /> Fijar
              </label>
            </div>
          </div>

          <button disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {isSubmitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear tarea"}
          </button>
        </form>

        <div className="min-w-0">
          {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
          {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
          {loading ? <div className="card p-10 text-center text-slate-500">Cargando tareas...</div> : tasks.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">No hay tareas para estos filtros.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tasks.map((task) => {
                const overdue = task.status !== "completed" && isBefore(new Date(task.deadline), new Date());
                return (
                  <article key={task.id} className="rounded-2xl border border-black/10 p-5 shadow-sm" style={{ backgroundColor: task.color ?? "#fff7cc" }}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white/75 px-2.5 py-1 text-xs font-extrabold">{priorityLabel[task.priority]}</span>
                      <div className="flex gap-1">
                        <button onClick={() => void patchTask(task, { is_pinned: !task.is_pinned }, task.is_pinned ? "Tarea desfijada." : "Tarea fijada.")} className="rounded-lg p-2 hover:bg-white/60" aria-label={task.is_pinned ? "Desfijar tarea" : "Fijar tarea"}>
                          {task.is_pinned ? <PinOff size={17} /> : <Pin size={17} />}
                        </button>
                        <button onClick={() => startEditing(task)} className="rounded-lg p-2 hover:bg-white/60" aria-label={`Editar ${task.title}`}><Pencil size={17} /></button>
                        <button onClick={() => void removeTask(task)} className="rounded-lg p-2 text-red-700 hover:bg-red-50/70" aria-label={`Eliminar ${task.title}`}><Trash2 size={17} /></button>
                      </div>
                    </div>
                    <h2 className="mt-4 font-display text-lg font-extrabold">{task.title}</h2>
                    {task.description && <p className="mt-2 line-clamp-3 text-sm text-slate-700">{task.description}</p>}
                    <div className="mt-5 space-y-2 text-sm">
                      <p className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-700" : ""}`}>
                        <CalendarClock size={17} />
                        {format(new Date(task.deadline), "d MMM yyyy, HH:mm", { locale: es })}
                        {overdue && " · Vencida"}
                      </p>
                      <p>Responsable: <strong>{task.responsible?.full_name ?? "Sin nombre"}</strong></p>
                    </div>
                    <label className="mt-5 block border-t border-black/10 pt-4 text-xs font-bold uppercase tracking-wide">
                      Estado
                      <select value={task.status} onChange={(event) => void patchTask(task, { status: event.target.value as TaskStatus }, "Estado actualizado.")} className="mt-2 w-full rounded-lg border border-black/15 bg-white/75 px-3 py-2 text-sm normal-case">
                        <option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option>
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700"><span className="mb-2 block">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}
