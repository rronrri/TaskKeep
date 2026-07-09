"use client";

import { useEffect } from "react";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { Field } from "@/components/ui/field";
import type { ReminderSettings, Task, UserRole } from "@/types";

const DEFAULT_DEADLINE_OFFSETS = [7200, 4320, 1440];
const reminderOptionGroups = [
  {
    label: "Opciones rapidas",
    options: [
      { label: "Toda la ultima semana (7, 6, 5, 4, 3, 2 y 1 dias)", value: "10080,8640,7200,5760,4320,2880,1440" },
      { label: "Predeterminado recomendado", value: "7200,4320,1440" },
    ],
  },
  {
    label: "Semanas y dias",
    options: [
      { label: "Un mes antes", value: "43200" },
      { label: "3 semanas antes", value: "30240" },
      { label: "2 semanas antes", value: "20160" },
      { label: "10 dias antes", value: "14400" },
      { label: "Una semana antes", value: "10080" },
      { label: "6 dias antes", value: "8640" },
      { label: "5 dias antes", value: "7200" },
      { label: "4 dias antes", value: "5760" },
      { label: "3 dias antes", value: "4320" },
      { label: "2 dias antes", value: "2880" },
      { label: "1 dia antes", value: "1440" },
    ],
  },
  {
    label: "Horas y minutos",
    options: [
      { label: "12 horas antes", value: "720" },
      { label: "6 horas antes", value: "360" },
      { label: "4 horas antes", value: "240" },
      { label: "3 horas antes", value: "180" },
      { label: "2 horas antes", value: "120" },
      { label: "1 hora antes", value: "60" },
      { label: "30 minutos antes", value: "30" },
    ],
  },
];
const reminderOptions = reminderOptionGroups.flatMap((group) => group.options);

const schema = z.object({
  title: z.string().trim().min(2, "Ingresa un titulo").max(160),
  description: z.string().trim().max(5000),
  responsible_id: z.string(),
  deadline: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pending", "in_progress", "completed"]),
  reminder_mode: z.enum(["none", "daily", "monthly", "deadline"]),
  recurring_time: z.string(),
  monthly_day: z.string(),
  custom_deadline: z.boolean(),
  deadline_offsets: z.array(z.object({ value: z.string() })),
}).superRefine((value, context) => {
  if (value.reminder_mode === "deadline" && !value.deadline) {
    context.addIssue({ code: "custom", path: ["deadline"], message: "Selecciona una fecha limite" });
  }
  if (value.reminder_mode === "deadline" && value.custom_deadline) {
    const offsets = selectedOffsets(value.deadline_offsets);
    if (offsets.length === 0) {
      context.addIssue({ code: "custom", path: ["deadline_offsets"], message: "Selecciona al menos un aviso" });
    }
    const minutesLeft = minutesUntil(value.deadline);
    if (minutesLeft !== null && offsets.some((offset) => offset >= minutesLeft)) {
      context.addIssue({ code: "custom", path: ["deadline_offsets"], message: "Hay avisos que ocurren antes de hoy. Ajusta la fecha limite o elige avisos mas cercanos." });
    }
    if (new Set(offsets).size !== offsets.length) {
      context.addIssue({ code: "custom", path: ["deadline_offsets"], message: "No repitas avisos equivalentes" });
    }
  }
  if (value.reminder_mode === "deadline" && !value.custom_deadline && DEFAULT_DEADLINE_OFFSETS.every((offset) => {
    const minutesLeft = minutesUntil(value.deadline);
    return minutesLeft !== null && offset >= minutesLeft;
  })) {
    context.addIssue({ code: "custom", path: ["deadline_offsets"], message: "La fecha limite esta muy cerca. Personaliza un aviso en horas o minutos." });
  }
  if ((value.reminder_mode === "daily" || value.reminder_mode === "monthly") && !/^\d{2}:\d{2}$/.test(value.recurring_time)) {
    context.addIssue({ code: "custom", path: ["recurring_time"], message: "Selecciona una hora" });
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
  initialFolderId = null,
  mode = "full",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  responsibles: ResponsibleOption[];
  onSaved: (message: string) => Promise<void> | void;
  actorRole?: UserRole;
  currentUserId?: string;
  initialFolderId?: string | null;
  mode?: "full" | "reminders";
}) {
  const { register, handleSubmit, reset, setError, setValue, control, formState: { errors, isSubmitting } } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(actorRole, currentUserId),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "deadline_offsets" });
  const reminderMode = useWatch({ control, name: "reminder_mode" });
  const deadline = useWatch({ control, name: "deadline" });
  const customDeadline = useWatch({ control, name: "custom_deadline" });
  const deadlineOffsets = useWatch({ control, name: "deadline_offsets" }) ?? [];
  const remindersOnly = mode === "reminders" && Boolean(task);

  useEffect(() => {
    if (!open) return;
    reset(task ? valuesFromTask(task) : defaultValues(actorRole, currentUserId));
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
        title: values.title,
        description: values.description || null,
        responsible_id: actorRole === "collaborator" ? currentUserId : values.responsible_id,
        priority: values.priority,
        status: values.status,
        reminder_mode: values.reminder_mode,
        reminder_settings: buildReminderSettings(values),
        deadline: values.reminder_mode === "deadline" && values.deadline ? new Date(values.deadline).toISOString() : null,
        folder_id: task ? undefined : initialFolderId,
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

  const enableCustomDeadline = () => {
    setValue("custom_deadline", true, { shouldDirty: true });
    if (deadlineOffsets.length === 0) append({ value: "10080" });
  };

  const usedOptions = new Set(deadlineOffsets.flatMap((item) => splitOption(item.value)));
  const minutesLeft = minutesUntil(deadline);
  const hasAvailableReminderOption = reminderOptions.some((option) => isOptionAvailable(option.value, usedOptions, [], minutesLeft));
  const dialogTitle = remindersOnly ? "Recordatorios" : task ? "Editar tarea" : "Nueva tarea";
  const dialogDescription = remindersOnly ? `Configura solo las alertas de "${task?.title ?? "esta tarea"}".` : actorRole === "collaborator" ? "Esta tarea sera personal y quedara asignada unicamente a ti." : "Completa los datos y configura avisos a tu medida.";

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description={dialogDescription}
      size="lg"
      scrollable={false}
    >
      <form onSubmit={handleSubmit(submit)} className="grid gap-3" noValidate>
        {remindersOnly && (
          <>
            <input type="hidden" {...register("title")} />
            <input type="hidden" {...register("description")} />
            <input type="hidden" {...register("responsible_id")} />
            <input type="hidden" {...register("priority")} />
            <input type="hidden" {...register("status")} />
          </>
        )}
        {!remindersOnly && (
        <>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titulo" error={errors.title?.message}>
            <input {...register("title")} className="input !py-2" />
          </Field>
          {actorRole === "manager" ? (
            <Field label="Responsable" error={errors.responsible_id?.message}>
              <select {...register("responsible_id")} className="input !py-2">
                <option value="">Selecciona una persona</option>
                {responsibles.map((person) => <option key={person.id} value={person.id}>{person.full_name} - {person.role === "manager" ? "Gestor/a" : "Colaborador/a"}</option>)}
              </select>
            </Field>
          ) : <input type="hidden" {...register("responsible_id")} />}
        </div>

        <Field label="Descripcion" error={errors.description?.message}>
          <textarea {...register("description")} rows={2} className="input resize-none !py-2" />
        </Field>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Prioridad" error={errors.priority?.message}>
            <select {...register("priority")} className="input !py-2">
              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Critica</option>
            </select>
          </Field>
          <Field label="Estado" error={errors.status?.message}>
            <select {...register("status")} className="input !py-2">
              <option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option>
            </select>
          </Field>
          <Field label="Recordatorio" error={errors.reminder_mode?.message}>
            <div className="relative">
              <BellRing className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#9A7B24]" size={17} />
              <select {...register("reminder_mode")} className="input !border-[#9A7B24] !bg-[#F3EDDC] !py-2 !pl-10 !pr-3 font-semibold !text-[#6b5619]">
                <option value="none">Sin recordatorios</option>
                <option value="daily">Una vez al dia</option>
                <option value="monthly">Una vez al mes</option>
                <option value="deadline">Establecer fecha limite</option>
              </select>
            </div>
          </Field>
        </div>
        </>
        )}

        {remindersOnly && (
          <Field label="Recordatorio" error={errors.reminder_mode?.message}>
            <div className="relative">
              <BellRing className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#9A7B24]" size={17} />
              <select {...register("reminder_mode")} className="input !border-[#9A7B24] !bg-[#F3EDDC] !py-2 !pl-10 !pr-3 font-semibold !text-[#6b5619]">
                <option value="none">Sin recordatorios</option>
                <option value="daily">Una vez al dia</option>
                <option value="monthly">Una vez al mes</option>
                <option value="deadline">Establecer fecha limite</option>
              </select>
            </div>
          </Field>
        )}

        {(reminderMode === "daily" || reminderMode === "monthly") && (
          <div className="grid gap-3 rounded-lg border border-[#d9c98f] bg-[#F3EDDC]/70 p-3 md:grid-cols-2">
            <Field label="Hora del recordatorio" error={errors.recurring_time?.message}>
              <input type="time" {...register("recurring_time")} className="input !py-2" />
            </Field>
            {reminderMode === "monthly" && (
              <Field label="Dia del mes" error={errors.monthly_day?.message}>
                <input type="number" min={1} max={31} {...register("monthly_day")} className="input !py-2" />
              </Field>
            )}
          </div>
        )}

        {reminderMode === "deadline" && (
          <div className="grid gap-3 rounded-lg border border-[#d9c98f] bg-[#F3EDDC]/70 p-3">
            <Field label="Fecha limite" error={errors.deadline?.message}>
              <input type="datetime-local" {...register("deadline")} className="input !py-2" />
            </Field>
            {!customDeadline ? (
              <div className="rounded-lg border border-[#d9c98f] bg-[var(--surface)] p-4">
                <p className="text-sm font-bold text-[#6b5619]">{defaultReminderText(minutesLeft)}</p>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">Este es el comportamiento recomendado para no saturar a la persona responsable.</p>
                {errors.deadline_offsets?.message && <p className="mt-2 text-xs font-semibold text-[var(--stamp-red)]">{errors.deadline_offsets.message}</p>}
                <button type="button" onClick={enableCustomDeadline} className="btn btn-ghost mt-3 !px-4 !py-2 text-sm !text-[#6b5619]">
                  Personalizar
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-[#d9c98f] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#6b5619]">Recordatorios personalizados</p>
                    <p className="text-xs text-[var(--ink-soft)]">Agrega uno o varios momentos. No se puede repetir el mismo aviso.</p>
                  </div>
                  <button type="button" disabled={!hasAvailableReminderOption} onClick={() => append({ value: firstAvailableOption(usedOptions, minutesLeft) })} className="btn !bg-[#9A7B24] !px-3 !py-2 text-sm text-white hover:!bg-[#7d6420]">
                    <Plus size={16} /> Agregar
                  </button>
                </div>
                <div className="mt-3 grid gap-2">
                  {fields.map((field, index) => {
                    const currentValue = deadlineOffsets[index]?.value ?? "";
                    const currentOffsets = splitOption(currentValue);
                    return (
                      <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select {...register(`deadline_offsets.${index}.value`)} className="input !py-2">
                          {reminderOptionGroups.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((option) => {
                                const optionOffsets = splitOption(option.value);
                                const duplicated = optionOffsets.some((offset) => usedOptions.has(offset) && !currentOffsets.includes(offset));
                                const tooEarly = minutesLeft !== null && optionOffsets.some((offset) => offset >= minutesLeft);
                                return <option key={option.value} value={option.value} disabled={duplicated || tooEarly}>{option.label}{tooEarly ? " - no aplica para esta fecha" : ""}</option>;
                              })}
                            </optgroup>
                          ))}
                        </select>
                        <button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="rounded-md border border-[var(--stamp-red)] p-2 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Quitar recordatorio">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {errors.deadline_offsets?.message && <p className="mt-2 text-xs font-semibold text-[var(--stamp-red)]">{errors.deadline_offsets.message}</p>}
                <button type="button" onClick={() => setValue("custom_deadline", false, { shouldDirty: true })} className="mt-3 text-xs font-bold text-[#6b5619] hover:underline">
                  Usar predeterminado
                </button>
              </div>
            )}
          </div>
        )}

        {errors.root?.message && <p role="alert" className="rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm text-[var(--stamp-red)]">{errors.root.message}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost !py-2">Cancelar</button>
          <button disabled={isSubmitting} className="btn btn-primary !px-5 !py-2">{isSubmitting ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </AppDialog>
  );
}

function defaultValues(actorRole: UserRole, currentUserId?: string): Input {
  return {
    title: "",
    description: "",
    responsible_id: actorRole === "collaborator" ? currentUserId ?? "" : "",
    deadline: "",
    priority: "medium",
    status: "pending",
    reminder_mode: "none",
    recurring_time: "09:00",
    monthly_day: "1",
    custom_deadline: false,
    deadline_offsets: [{ value: "10080" }],
  };
}

function valuesFromTask(task: Task): Input {
  const settings = task.reminder_settings ?? {};
  const offsets = settings.deadline_offsets ?? [];
  const isPreset = sameOffsets(offsets, DEFAULT_DEADLINE_OFFSETS);
  return {
    title: task.title,
    description: task.description ?? "",
    responsible_id: task.responsible_id,
    deadline: task.deadline ? toLocalDateTime(task.deadline) : "",
    priority: task.priority,
    status: task.status,
    reminder_mode: task.reminder_mode ?? (task.reminders_enabled ? "deadline" : "none"),
    recurring_time: settings.recurring_time ?? "09:00",
    monthly_day: String(settings.monthly_day ?? 1),
    custom_deadline: offsets.length > 0 && !isPreset,
    deadline_offsets: offsets.length > 0 && !isPreset ? offsets.map((offset) => ({ value: String(offset) })) : [{ value: "10080" }],
  };
}

function buildReminderSettings(values: Input): ReminderSettings {
  if (values.reminder_mode === "deadline") {
    const offsets = values.custom_deadline ? selectedOffsets(values.deadline_offsets) : DEFAULT_DEADLINE_OFFSETS;
    const minutesLeft = minutesUntil(values.deadline);
    return { deadline_offsets: offsets.filter((offset) => minutesLeft === null || offset < minutesLeft).sort((a, b) => b - a) };
  }
  if (values.reminder_mode === "daily" || values.reminder_mode === "monthly") {
    return {
      recurring_time: values.recurring_time,
      monthly_day: Number(values.monthly_day || 1),
      timezone_offset_minutes: new Date().getTimezoneOffset(),
    };
  }
  return {};
}

function selectedOffsets(items: Array<{ value: string }>) {
  return items.flatMap((item) => splitOption(item.value));
}

function splitOption(value: string) {
  return value.split(",").map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
}

function minutesUntil(value: string) {
  if (!value) return null;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return null;
  return Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 60000));
}

function defaultReminderText(minutesLeft: number | null) {
  const valid = DEFAULT_DEADLINE_OFFSETS.filter((offset) => minutesLeft === null || offset < minutesLeft);
  if (valid.length === 0) return "La fecha limite esta muy cerca; usa Personalizar para elegir un aviso en horas o minutos.";
  const labels = valid.map((offset) => offset / 1440).join(", ");
  return `Se notificara al correo ${labels} dia${valid.length === 1 && valid[0] === 1440 ? "" : "s"} antes de la fecha limite.`;
}

function firstAvailableOption(usedOptions: Set<number>, minutesLeft: number | null) {
  return reminderOptions.find((option) => isOptionAvailable(option.value, usedOptions, [], minutesLeft))?.value ?? "30";
}

function isOptionAvailable(value: string, usedOptions: Set<number>, currentOffsets: number[], minutesLeft: number | null) {
  const offsets = splitOption(value);
  const duplicated = offsets.some((offset) => usedOptions.has(offset) && !currentOffsets.includes(offset));
  const tooEarly = minutesLeft !== null && offsets.some((offset) => offset >= minutesLeft);
  return !duplicated && !tooEarly;
}

function sameOffsets(left: number[], right: number[]) {
  return left.length === right.length && [...left].sort((a, b) => a - b).every((value, index) => value === [...right].sort((a, b) => a - b)[index]);
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

