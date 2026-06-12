"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { Field } from "@/components/ui/field";
import type { Task } from "@/types";

const schema = z.object({
  title: z.string().trim().min(2, "Ingresa un título").max(160),
  description: z.string().trim().max(5000),
  responsible_id: z.string().uuid("Selecciona un responsable"),
  deadline: z.string().min(1, "Selecciona una fecha límite"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pending", "in_progress", "completed"]),
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  responsibles: ResponsibleOption[];
  onSaved: (message: string) => Promise<void> | void;
}) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Input>({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    if (!open) return;
    reset(task ? {
      title: task.title,
      description: task.description ?? "",
      responsible_id: task.responsible_id,
      deadline: toLocalDateTime(task.deadline),
      priority: task.priority,
      status: task.status,
    } : {
      title: "",
      description: "",
      responsible_id: "",
      deadline: "",
      priority: "medium",
      status: "pending",
    });
  }, [open, reset, task]);

  const submit = async (values: Input) => {
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        description: values.description || null,
        deadline: new Date(values.deadline).toISOString(),
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
    <AppDialog open={open} onOpenChange={onOpenChange} title={task ? "Editar tarea" : "Nueva tarea"} description="Define los datos principales. Puedes fijarla después desde el tablero." size="md">
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Título" error={errors.title?.message}>
          <input {...register("title")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
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
        <div className="grid gap-4 sm:grid-cols-2">
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
        {errors.root?.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 font-bold">Cancelar</button>
          <button disabled={isSubmitting} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white disabled:opacity-60">
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
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
