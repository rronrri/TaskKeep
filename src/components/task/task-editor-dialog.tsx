"use client";

import { useEffect } from "react";
import { BellRing } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { Field } from "@/components/ui/field";
import type { Task, UserRole } from "@/types";

const schema = z.object({
  title: z.string().trim().min(2, "Ingresa un título").max(160),
  description: z.string().trim().max(5000),
  responsible_id: z.string(),
  deadline: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pending", "in_progress", "completed"]),
  reminder_mode: z.enum(["none", "daily", "monthly", "deadline"]),
}).superRefine((value, context) => {
  if (value.reminder_mode === "deadline" && !value.deadline) {
    context.addIssue({ code: "custom", path: ["deadline"], message: "Selecciona una fecha límite" });
  }
});

type Input = z.infer<typeof schema>;

export interface ResponsibleOption {
  id: string;
  full_name: string;
  role: "manager" | "collaborator";
}

export function TaskEditorDialog({
  open,
  onOpenChange,
  task,
  responsibles,
  onSaved,
  actorRole = "manager",
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  responsibles: ResponsibleOption[];
  onSaved: (message: string) => Promise<void> | void;
  actorRole?: UserRole;
  currentUserId?: string;
}) {
  const { register, handleSubmit, reset, setError, control, formState: { errors, isSubmitting } } = useForm<Input>({
    resolver: zodResolver(schema),
  });
  const reminderMode = useWatch({ control, name: "reminder_mode" });

  useEffect(() => {
    if (!open) return;
    reset(task ? {
      title: task.title,
      description: task.description ?? "",
      responsible_id: task.responsible_id,
      deadline: task.deadline ? toLocalDateTime(task.deadline) : "",
      priority: task.priority,
      status: task.status,
      reminder_mode: task.reminder_mode ?? (task.reminders_enabled ? "deadline" : "none"),
    } : {
      title: "",
      description: "",
      responsible_id: actorRole === "collaborator" ? currentUserId ?? "" : "",
      deadline: "",
      priority: "medium",
      status: "pending",
      reminder_mode: "none",
    });
  }, [actorRole, currentUserId, open, reset, task]);

  const submit = async (values: Input) => {
    if (actorRole === "manager" && !z.string().uuid().safeParse(values.responsible_id).success) {
      setError("responsible_id", { message: "Selecciona un/a responsable" });
      return;
    }
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        responsible_id: actorRole === "collaborator" ? currentUserId : values.responsible_id,
        description: values.description || null,
        deadline: values.reminder_mode === "deadline" && values.deadline
          ? new Date(values.deadline).toISOString()
          : null,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError("root", { message: body.error ?? "No se pudo guardar la tarea" });
      return;
    }
    onOpenChange(false);
    await onSaved(task ? "Tarea actualizada correctamente." : "Tarea creada correctamente.");
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Editar tarea" : "Nueva tarea"}
      description={actorRole === "collaborator" ? "Esta tarea será personal y quedará asignada únicamente a ti." : "Completa los datos y configura los recordatorios que necesites."}
      size="lg"
      scrollable={false}
    >
      <form onSubmit={handleSubmit(submit)} className="grid gap-3" noValidate>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Título" error={errors.title?.message}>
            <input {...register("title")} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
          </Field>
          {actorRole === "manager" ? (
            <Field label="Responsable" error={errors.responsible_id?.message}>
              <select {...register("responsible_id")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="">Selecciona una persona</option>
                {responsibles.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.role === "manager" ? "Gestor/a" : "Colaborador/a"}</option>)}
              </select>
            </Field>
          ) : <input type="hidden" {...register("responsible_id")} />}
        </div>

        <Field label="Descripción" error={errors.description?.message}>
          <textarea {...register("description")} rows={2} className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2" />
        </Field>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Prioridad" error={errors.priority?.message}>
            <select {...register("priority")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
            </select>
          </Field>
          <Field label="Estado" error={errors.status?.message}>
            <select {...register("status")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option>
            </select>
          </Field>
          <Field label="Recordatorio" error={errors.reminder_mode?.message}>
            <div className="relative">
              <BellRing className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-700" size={17} />
              <select
                {...register("reminder_mode")}
                title="Elige avisos diarios, mensuales o por fecha límite. En este último caso se enviarán 5, 3 y 1 día antes."
                className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2 pl-10 pr-3 font-semibold text-amber-950"
              >
                <option value="none">Sin recordatorios</option>
                <option value="daily">Una vez al día</option>
                <option value="monthly">Una vez al mes</option>
                <option value="deadline">Establecer fecha límite</option>
              </select>
            </div>
          </Field>
        </div>

        {reminderMode === "deadline" && (
          <Field label="Fecha límite" error={errors.deadline?.message}>
            <input type="datetime-local" {...register("deadline")} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
            <span className="mt-1 block text-xs text-slate-500">Se enviarán recordatorios 5, 3 y 1 día antes.</span>
          </Field>
        )}

        {errors.root?.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50">Cancelar</button>
          <button disabled={isSubmitting} className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{isSubmitting ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </AppDialog>
  );
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
