import { NextResponse } from "next/server";
import { Resend } from "resend";
import { TaskReminderEmail } from "@/emails/TaskReminderEmail";
import { createAdminClient } from "@/lib/supabase/server";

const reminders = [{ days: 7, type: "deadline_7_days" }, { days: 3, type: "deadline_3_days" }, { days: 1, type: "deadline_1_day" }] as const;

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const end = new Date(now.getTime() + 8 * 86400000);
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id,title,deadline,responsible_id,responsible:users!tasks_responsible_id_fkey(email)")
    .neq("status", "completed").is("deleted_at", null)
    .gte("deadline", now.toISOString()).lt("deadline", end.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const task of tasks ?? []) {
    const daysLeft = Math.ceil((new Date(task.deadline).getTime() - now.getTime()) / 86400000);
    const reminder = reminders.find((item) => item.days === daysLeft);
    const responsible = Array.isArray(task.responsible) ? task.responsible[0] : task.responsible;
    if (!reminder || !responsible?.email) continue;
    const { data: existing } = await supabase.from("notification_logs").select("id").eq("task_id", task.id).eq("user_id", task.responsible_id).eq("notification_type", reminder.type).maybeSingle();
    if (existing) continue;
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!, to: responsible.email,
      subject: `Recordatorio: ${task.title}`, react: TaskReminderEmail({ taskTitle: task.title, deadline: task.deadline, days: reminder.days }),
    });
    const failed = Boolean(result.error);
    await supabase.from("notification_logs").insert({
      task_id: task.id, user_id: task.responsible_id, notification_type: reminder.type,
      email: responsible.email, status: failed ? "failed" : "sent",
      provider_message_id: result.data?.id ?? null, error_message: result.error?.message ?? null,
    });
    if (!failed) sent++;
  }
  return NextResponse.json({ processed: tasks?.length ?? 0, sent });
}
