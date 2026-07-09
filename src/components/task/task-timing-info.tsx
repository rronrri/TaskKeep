"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarClock } from "lucide-react";
import type { Task } from "@/types";

export function TaskTimingInfo({ task, detailed = false, compact = false }: { task: Task; detailed?: boolean; compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const target = task.status === "completed" ? null : nextTarget(task, now);
  if (!detailed && !target) return null;

  return (
    <div className={compact ? "mt-2" : "mt-4"}>
      {detailed && (
        <div className={`flex items-start gap-3 rounded-md border p-3 ${task.reminders_enabled ? "border-[#9A7B24] bg-[#F3EDDC] text-[#6b5619]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]"}`}>
          <BellRing className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-bold">{task.reminders_enabled ? "Recordatorio activo" : "Sin recordatorios"}</p>
            <p className="mt-0.5 text-xs leading-5">{describeReminder(task)}</p>
          </div>
        </div>
      )}

      {target && (
        <div className={detailed ? "mt-3" : ""}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ink-soft)]">
            <span className="flex min-w-0 items-center gap-1.5">
              {target.kind === "reminder" ? <BellRing className="shrink-0 text-[#9A7B24]" size={14} /> : <CalendarClock className="shrink-0 text-[var(--primary)]" size={14} />}
              <span className="truncate">{target.kind === "reminder" ? "Próximo recordatorio" : "Fecha límite"}</span>
            </span>
            <span className="folio shrink-0">{formatRemaining(target.at.getTime() - now.getTime())}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--paper-deep)]" role="progressbar" aria-label={`Tiempo restante para ${target.kind === "reminder" ? "el próximo recordatorio" : "la fecha límite"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(target.progress)}>
            <div className={`h-full rounded-full transition-[width] duration-500 ${target.kind === "reminder" ? "bg-[#9A7B24]" : "bg-[var(--primary)]"}`} style={{ width: `${target.progress}%` }} />
          </div>
          {!compact && <p className="folio mt-1.5 text-right">{target.at.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
      )}
    </div>
  );
}

function describeReminder(task: Task) {
  if (!task.reminders_enabled || task.reminder_mode === "none") return "Esta tarea no enviará avisos por correo.";
  const time = task.reminder_settings?.recurring_time ?? "09:00";
  if (task.reminder_mode === "daily") return `Se enviará todos los días a las ${time}.`;
  if (task.reminder_mode === "monthly") return `Se enviará el día ${task.reminder_settings?.monthly_day ?? 1} de cada mes a las ${time}.`;
  const offsets = task.reminder_settings?.deadline_offsets ?? [];
  return offsets.length ? `Se avisará ${offsets.map(formatOffset).join(", ")} antes de la fecha límite.` : "Se avisará antes de la fecha límite.";
}

function nextTarget(task: Task, now: Date) {
  let at: Date | null = null;
  let kind: "reminder" | "deadline" = "deadline";
  let cycleMs: number | null = null;

  if (task.reminders_enabled && (task.reminder_mode === "daily" || task.reminder_mode === "monthly")) {
    at = nextRecurring(task, now);
    kind = "reminder";
    cycleMs = task.reminder_mode === "daily" ? 24 * 60 * 60_000 : 31 * 24 * 60 * 60_000;
  } else if (task.reminders_enabled && task.reminder_mode === "deadline" && task.deadline) {
    const deadline = new Date(task.deadline).getTime();
    const nextReminder = (task.reminder_settings?.deadline_offsets ?? [])
      .map((minutes) => deadline - minutes * 60_000)
      .filter((value) => value > now.getTime())
      .sort((a, b) => a - b)[0];
    if (nextReminder) {
      at = new Date(nextReminder);
      kind = "reminder";
    }
  }

  if (!at && task.deadline && new Date(task.deadline).getTime() > now.getTime()) {
    at = new Date(task.deadline);
    kind = "deadline";
  }
  if (!at) return null;

  const start = cycleMs ? at.getTime() - cycleMs : new Date(task.created_at).getTime();
  const total = Math.max(1, at.getTime() - start);
  return { at, kind, progress: Math.min(100, Math.max(0, ((now.getTime() - start) / total) * 100)) };
}

function nextRecurring(task: Task, now: Date) {
  const [hour, minute] = (task.reminder_settings?.recurring_time ?? "09:00").split(":").map(Number);
  const offset = task.reminder_settings?.timezone_offset_minutes ?? 0;
  const localNow = new Date(now.getTime() - offset * 60_000);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();
  const targetDay = task.reminder_mode === "monthly" ? clampDay(year, month, task.reminder_settings?.monthly_day ?? 1) : day;
  let candidate = localToUtc(year, month, targetDay, hour, minute, offset);
  if (candidate <= now) {
    if (task.reminder_mode === "daily") candidate = localToUtc(year, month, day + 1, hour, minute, offset);
    else {
      const nextMonth = month + 1;
      const nextYear = year + Math.floor(nextMonth / 12);
      const normalizedMonth = nextMonth % 12;
      candidate = localToUtc(nextYear, normalizedMonth, clampDay(nextYear, normalizedMonth, task.reminder_settings?.monthly_day ?? 1), hour, minute, offset);
    }
  }
  return candidate;
}

function localToUtc(year: number, month: number, day: number, hour: number, minute: number, offset: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) + offset * 60_000);
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(Math.max(day, 1), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
}

function formatOffset(minutes: number) {
  if (minutes % 10080 === 0) return `${minutes / 10080} ${minutes === 10080 ? "semana" : "semanas"}`;
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? "día" : "días"}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"}`;
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) return "ahora";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return `en ${hours} h${restMinutes ? ` ${restMinutes} min` : ""}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return `en ${days} d${restHours ? ` ${restHours} h` : ""}`;
}
