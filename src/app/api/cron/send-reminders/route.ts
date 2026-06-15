import { NextResponse } from "next/server";
import { Resend } from "resend";
import { TaskReminderEmail } from "@/emails/TaskReminderEmail";
import { createAdminClient } from "@/lib/supabase/server";
import type { ReminderMode } from "@/types";

const deadlineReminders = [{ days: 5, type: "deadline_5_days" }, { days: 3, type: "deadline_3_days" }, { days: 1, type: "deadline_1_day" }] as const;
type Person = { id: string; full_name: string; email: string; role: "manager" | "collaborator" };

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Resend no está configurado" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id,title,description,priority,deadline,reminder_mode,next_reminder_at,responsible_id,created_by,responsible:users!tasks_responsible_id_fkey(id,full_name,email,role),creator:users!tasks_created_by_fkey(id,full_name,email,role)")
    .eq("reminders_enabled", true)
    .neq("status", "completed")
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const task of tasks ?? []) {
    const schedule = dueSchedule(task.reminder_mode as ReminderMode, task.deadline, task.next_reminder_at, now);
    if (!schedule) continue;
    const responsible = one(task.responsible);
    const creator = one(task.creator);
    if (!responsible?.email) continue;

    const recipients: Array<{ person: Person; managerCopy: boolean }> = [{ person: responsible, managerCopy: false }];
    if (creator?.role === "manager" && responsible.role === "collaborator" && creator.id !== responsible.id) {
      recipients.push({ person: creator, managerCopy: true });
    }

    for (const recipient of recipients) {
      const reminderKey = `${schedule.key}:${recipient.person.id}`;
      const { data: existing } = await supabase
        .from("notification_logs")
        .select("id")
        .eq("task_id", task.id)
        .eq("user_id", recipient.person.id)
        .eq("reminder_key", reminderKey)
        .maybeSingle();
      if (existing) continue;

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: recipient.person.email,
        subject: recipient.managerCopy ? `Tarea de ${responsible.full_name}: ${task.title}` : `Recordatorio: ${task.title}`,
        react: TaskReminderEmail({
          taskTitle: task.title,
          description: task.description,
          priority: task.priority,
          deadline: task.deadline,
          days: schedule.days,
          reminderMode: task.reminder_mode as ReminderMode,
          recipientName: recipient.person.full_name,
          responsibleName: responsible.full_name,
          managerCopy: recipient.managerCopy,
        }),
      });
      const sendFailed = Boolean(result.error);
      await supabase.from("notification_logs").insert({
        task_id: task.id,
        user_id: recipient.person.id,
        notification_type: schedule.type,
        reminder_key: reminderKey,
        email: recipient.person.email,
        status: sendFailed ? "failed" : "sent",
        provider_message_id: result.data?.id ?? null,
        error_message: result.error?.message ?? null,
      });
      if (sendFailed) failed++;
      else sent++;
    }

    if (task.reminder_mode === "daily" || task.reminder_mode === "monthly") {
      await supabase
        .from("tasks")
        .update({ next_reminder_at: nextOccurrence(task.reminder_mode, now).toISOString() })
        .eq("id", task.id);
    }
  }
  return NextResponse.json({ processed: tasks?.length ?? 0, sent, failed });
}

export async function GET(request: Request) {
  return POST(request);
}

function dueSchedule(mode: ReminderMode, deadline: string | null, nextReminderAt: string | null, now: Date) {
  if (mode === "deadline" && deadline) {
    const daysLeft = Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400000);
    const reminder = deadlineReminders.find((item) => item.days === daysLeft);
    return reminder ? { type: reminder.type, key: reminder.type, days: reminder.days } : null;
  }
  if ((mode === "daily" || mode === "monthly") && (!nextReminderAt || new Date(nextReminderAt) <= now)) {
    const period = mode === "daily" ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 7);
    return { type: mode, key: `${mode}_${period}`, days: null };
  }
  return null;
}

function nextOccurrence(mode: "daily" | "monthly", now: Date) {
  const next = new Date(now);
  if (mode === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
