import { Resend } from "resend";
import { TaskReminderEmail } from "@/emails/TaskReminderEmail";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_DEADLINE_OFFSETS, nextRecurringOccurrence, normalizeReminderSettings } from "@/lib/tasks/reminders";
import type { ReminderMode, ReminderSettings } from "@/types";

// Resend acepta programar correos hasta 30 días en el futuro. Usamos 29 como
// margen de seguridad. Al crear/editar una tarea solo programamos lo cercano
// (rápido para la petición); el planner diario rellena el resto de la ventana.
const PLANNER_HORIZON_DAYS = 29;
const ON_WRITE_HORIZON_DAYS = 3;
const SCHEDULE_BUFFER_MS = 5000;

type Person = { id: string; full_name: string; email: string; role: "manager" | "collaborator" | "admin" };
type Recipient = { person: Person; managerCopy: boolean };
type Occurrence = {
  key: string;
  type: string;
  at: Date;
  days: number | null;
  leadMinutes: number | null;
};
type ReminderTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  deadline: string | null;
  reminder_mode: ReminderMode;
  reminder_settings: ReminderSettings | null;
  reminders_enabled: boolean;
  status: string;
  deleted_at: string | null;
  responsible: Person | Person[] | null;
  creator: Person | Person[] | null;
};

const TASK_SELECT =
  "id,title,description,priority,deadline,reminder_mode,reminder_settings,reminders_enabled,status,deleted_at," +
  "responsible:users!tasks_responsible_id_fkey(id,full_name,email,role)," +
  "creator:users!tasks_created_by_fkey(id,full_name,email,role)";

function reminderClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return { resend: new Resend(apiKey), from };
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function recipientsFor(task: ReminderTask): { responsible: Person; recipients: Recipient[] } | null {
  const responsible = one(task.responsible);
  if (!responsible?.email) return null;
  const creator = one(task.creator);
  const recipients: Recipient[] = [{ person: responsible, managerCopy: false }];
  if (creator?.role === "manager" && responsible.role === "collaborator" && creator.id !== responsible.id) {
    recipients.push({ person: creator, managerCopy: true });
  }
  return { responsible, recipients };
}

function notificationType(minutes: number) {
  if (minutes === 5 * 24 * 60) return "deadline_5_days";
  if (minutes === 3 * 24 * 60) return "deadline_3_days";
  if (minutes === 24 * 60) return "deadline_1_day";
  return "deadline_custom";
}

function periodKey(at: Date, offsetMinutes: number, kind: "day" | "month") {
  const local = new Date(at.getTime() + offsetMinutes * 60000).toISOString();
  return kind === "day" ? local.slice(0, 10) : local.slice(0, 7);
}

// Calcula las ocurrencias de recordatorio que caen dentro de la ventana [now, now + horizon].
function planReminders(task: ReminderTask, now: Date, horizonDays: number): Occurrence[] {
  const mode = task.reminder_mode;
  const earliest = now.getTime() + SCHEDULE_BUFFER_MS;
  const horizonEnd = now.getTime() + horizonDays * 24 * 60 * 60000;

  if (mode === "deadline" && task.deadline) {
    const deadline = new Date(task.deadline);
    if (deadline.getTime() <= now.getTime()) return [];
    const offsets = normalizeReminderSettings(mode, task.reminder_settings).deadline_offsets ?? DEFAULT_DEADLINE_OFFSETS;
    return offsets.flatMap((minutes) => {
      const at = new Date(deadline.getTime() - minutes * 60000);
      if (at.getTime() < earliest || at.getTime() > horizonEnd) return [];
      return [{
        key: `deadline_${minutes}_minutes`,
        type: notificationType(minutes),
        at,
        days: minutes % 1440 === 0 ? minutes / 1440 : null,
        leadMinutes: minutes,
      }];
    });
  }

  if (mode === "daily" || mode === "monthly") {
    const settings = normalizeReminderSettings(mode, task.reminder_settings);
    const offset = settings.timezone_offset_minutes ?? 0;
    const out: Occurrence[] = [];
    let occurrence = nextRecurringOccurrence(mode, settings, now);
    // Tope de iteraciones de seguridad (diario: ~30, mensual: ~2).
    for (let i = 0; i < 40 && occurrence.getTime() <= horizonEnd; i += 1) {
      if (occurrence.getTime() >= earliest) {
        const period = periodKey(occurrence, offset, mode === "daily" ? "day" : "month");
        out.push({ key: `${mode}_${period}`, type: mode, at: occurrence, days: null, leadMinutes: null });
      }
      occurrence = mode === "daily"
        ? new Date(occurrence.getTime() + 24 * 60 * 60000)
        : nextRecurringOccurrence(mode, settings, occurrence);
    }
    return out;
  }

  return [];
}

function buildEmail(task: ReminderTask, occ: Occurrence, recipient: Recipient, responsible: Person) {
  return {
    subject: recipient.managerCopy ? `Tarea de ${responsible.full_name}: ${task.title}` : `Recordatorio: ${task.title}`,
    react: TaskReminderEmail({
      taskTitle: task.title,
      description: task.description,
      priority: task.priority,
      deadline: task.deadline,
      days: occ.days,
      leadMinutes: occ.leadMinutes,
      reminderMode: task.reminder_mode,
      recipientName: recipient.person.full_name,
      responsibleName: responsible.full_name,
      managerCopy: recipient.managerCopy,
    }),
  };
}

// Programa en Resend las ocurrencias de la ventana que aún no estén programadas/enviadas.
// Es aditivo e idempotente: nunca duplica un recordatorio ya existente.
async function scheduleMissing(
  supabase: ReturnType<typeof createAdminClient>,
  client: NonNullable<ReturnType<typeof reminderClient>>,
  task: ReminderTask,
  now: Date,
  horizonDays: number,
) {
  const occurrences = planReminders(task, now, horizonDays);
  if (occurrences.length === 0) return { scheduled: 0, failed: 0 };
  const target = recipientsFor(task);
  if (!target) return { scheduled: 0, failed: 0 };

  const { data: existing } = await supabase
    .from("notification_logs")
    .select("reminder_key")
    .eq("task_id", task.id)
    .in("status", ["scheduled", "sent"]);
  const taken = new Set((existing ?? []).map((row) => row.reminder_key));

  let scheduled = 0;
  let failed = 0;
  for (const occ of occurrences) {
    for (const recipient of target.recipients) {
      const reminderKey = `${occ.key}:${recipient.person.id}`;
      if (taken.has(reminderKey)) continue;
      const { subject, react } = buildEmail(task, occ, recipient, target.responsible);
      const result = await client.resend.emails.send({
        from: client.from,
        to: recipient.person.email,
        subject,
        react,
        scheduledAt: occ.at.toISOString(),
      });
      const sendFailed = Boolean(result.error);
      const { error: logError } = await supabase.from("notification_logs").upsert({
        task_id: task.id,
        user_id: recipient.person.id,
        notification_type: occ.type,
        reminder_key: reminderKey,
        email: recipient.person.email,
        status: sendFailed ? "failed" : "scheduled",
        provider_message_id: result.data?.id ?? null,
        error_message: result.error?.message ?? null,
        // Para los programados guardamos la hora de disparo prevista.
        sent_at: occ.at.toISOString(),
      }, { onConflict: "task_id,user_id,reminder_key" });
      if (logError) throw logError;
      taken.add(reminderKey);
      if (sendFailed) failed += 1;
      else scheduled += 1;
    }
  }
  return { scheduled, failed };
}

type ScheduledRow = { id: string; provider_message_id: string | null; sent_at: string | null };

/**
 * Cancela en Resend las filas indicadas y marca como `cancelled` únicamente las
 * que se pudieron cancelar de verdad.
 *
 * Antes se marcaban todas por igual aunque la llamada a Resend hubiera fallado, y
 * quedaba un registro diciendo "cancelado" mientras el correo seguía en cola.
 */
async function cancelRows(
  supabase: ReturnType<typeof createAdminClient>,
  client: NonNullable<ReturnType<typeof reminderClient>>,
  rows: ScheduledRow[],
  now: Date,
) {
  if (rows.length === 0) return { cancelled: 0, failed: 0 };
  const cancelled: string[] = [];
  let failed = 0;

  await Promise.all(rows.map(async (row) => {
    // Si la hora de disparo ya pasó, Resend ya lo envió: no hay nada que cancelar,
    // pero la fila deja de estar pendiente.
    const fireTime = row.sent_at ? new Date(row.sent_at).getTime() : 0;
    if (!row.provider_message_id || fireTime <= now.getTime()) {
      cancelled.push(row.id);
      return;
    }
    try {
      const result = await client.resend.emails.cancel(row.provider_message_id);
      if (result.error) throw new Error(result.error.message);
      cancelled.push(row.id);
    } catch (error) {
      failed += 1;
      console.error("No se pudo cancelar un recordatorio en Resend", row.provider_message_id, error);
    }
  }));

  if (cancelled.length > 0) {
    const { error } = await supabase
      .from("notification_logs")
      .update({ status: "cancelled" })
      .in("id", cancelled);
    if (error) console.error("No se pudo marcar los recordatorios como cancelados", error.message);
  }
  return { cancelled: cancelled.length, failed };
}

async function pendingRowsForTasks(supabase: ReturnType<typeof createAdminClient>, taskIds: string[]) {
  if (taskIds.length === 0) return [] as ScheduledRow[];
  const { data } = await supabase
    .from("notification_logs")
    .select("id,provider_message_id,sent_at")
    .in("task_id", taskIds)
    .eq("status", "scheduled");
  return (data ?? []) as ScheduledRow[];
}

// Cancela en Resend todos los recordatorios futuros aún programados de una tarea.
async function cancelScheduled(
  supabase: ReturnType<typeof createAdminClient>,
  client: NonNullable<ReturnType<typeof reminderClient>>,
  taskId: string,
  now: Date,
) {
  const { data: rows } = await supabase
    .from("notification_logs")
    .select("id,provider_message_id,sent_at")
    .eq("task_id", taskId)
    .eq("status", "scheduled");
  await cancelRows(supabase, client, (rows ?? []) as ScheduledRow[], now);
}

async function loadTask(supabase: ReturnType<typeof createAdminClient>, taskId: string) {
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", taskId).maybeSingle();
  return (data ?? null) as unknown as ReminderTask | null;
}

function isEligible(task: ReminderTask) {
  return !task.deleted_at && task.status !== "completed" && task.reminders_enabled && task.reminder_mode !== "none";
}

/**
 * Reconcilia los recordatorios de una tarea tras crearla o editarla.
 * Cancela los programados futuros y reprograma según la configuración actual.
 * Se llama en cada create/update; no debe bloquear ni romper la petición.
 */
export async function syncTaskReminders(taskId: string) {
  const client = reminderClient();
  if (!client) return;
  const supabase = createAdminClient();
  const task = await loadTask(supabase, taskId);
  if (!task) return;
  const now = new Date();
  await cancelScheduled(supabase, client, taskId, now);
  if (isEligible(task)) {
    await scheduleMissing(supabase, client, task, now, ON_WRITE_HORIZON_DAYS);
  }
}

/** Cancela todos los recordatorios programados de una tarea (al eliminar/completar). */
export async function cancelTaskReminders(taskId: string) {
  const client = reminderClient();
  if (!client) return;
  const supabase = createAdminClient();
  await cancelScheduled(supabase, client, taskId, new Date());
}

/**
 * Cancela los recordatorios de varias tareas a la vez. Se usa al eliminar una
 * carpeta, que archiva todas las tareas que contiene.
 */
export async function cancelRemindersForTasks(taskIds: string[]) {
  const client = reminderClient();
  if (!client || taskIds.length === 0) return;
  const supabase = createAdminClient();
  const rows = await pendingRowsForTasks(supabase, taskIds);
  await cancelRows(supabase, client, rows, new Date());
}

/**
 * Cancela todo lo programado para una empresa antes de eliminarla.
 *
 * Debe ejecutarse ANTES de `delete_company_cascade`: esa función borra las filas
 * de `notification_logs`, y con ellas el `provider_message_id`, único dato que
 * permite cancelar el envío en Resend. Si se borra primero, los correos quedan en
 * cola de forma irreversible y se entregan igual durante semanas.
 */
export async function cancelCompanyReminders(companyId: string) {
  const client = reminderClient();
  if (!client) return;
  const supabase = createAdminClient();

  const [{ data: tasks }, { data: users }] = await Promise.all([
    supabase.from("tasks").select("id").eq("company_id", companyId),
    supabase.from("users").select("id").eq("company_id", companyId),
  ]);

  const rows = new Map<string, ScheduledRow>();
  for (const row of await pendingRowsForTasks(supabase, (tasks ?? []).map((task) => task.id))) {
    rows.set(row.id, row);
  }
  const userIds = (users ?? []).map((user) => user.id);
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("notification_logs")
      .select("id,provider_message_id,sent_at")
      .in("user_id", userIds)
      .eq("status", "scheduled");
    for (const row of (data ?? []) as ScheduledRow[]) rows.set(row.id, row);
  }

  await cancelRows(supabase, client, [...rows.values()], new Date());
}

/**
 * Cancela todo lo programado para una persona antes de eliminarla. Mismo motivo de
 * orden que `cancelCompanyReminders`: `delete_user_cascade` destruye las filas.
 */
export async function cancelUserReminders(userId: string) {
  const client = reminderClient();
  if (!client) return;
  const supabase = createAdminClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id")
    .or(`created_by.eq.${userId},responsible_id.eq.${userId}`);

  const rows = new Map<string, ScheduledRow>();
  for (const row of await pendingRowsForTasks(supabase, (tasks ?? []).map((task) => task.id))) {
    rows.set(row.id, row);
  }
  const { data: own } = await supabase
    .from("notification_logs")
    .select("id,provider_message_id,sent_at")
    .eq("user_id", userId)
    .eq("status", "scheduled");
  for (const row of (own ?? []) as ScheduledRow[]) rows.set(row.id, row);

  await cancelRows(supabase, client, [...rows.values()], new Date());
}

/**
 * Planner diario (cron): rellena la ventana de 30 días programando las ocurrencias
 * que van entrando (recurrencia diaria/mensual infinita y fechas límite lejanas).
 * Es puramente aditivo: no cancela nada y no reprograma lo ya existente.
 */
export async function runReminderPlanner() {
  const client = reminderClient();
  if (!client) return { error: "Resend no está configurado", status: 503 as const };
  const supabase = createAdminClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("reminders_enabled", true)
    .neq("status", "completed")
    .neq("reminder_mode", "none")
    .is("deleted_at", null);
  if (error) return { error: error.message, status: 500 as const };

  const now = new Date();
  let scheduled = 0;
  let failed = 0;
  for (const task of (tasks ?? []) as unknown as ReminderTask[]) {
    const result = await scheduleMissing(supabase, client, task, now, PLANNER_HORIZON_DAYS);
    scheduled += result.scheduled;
    failed += result.failed;
  }
  return { processed: tasks?.length ?? 0, scheduled, failed };
}
