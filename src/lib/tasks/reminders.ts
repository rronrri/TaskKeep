import type { ReminderMode, ReminderSettings } from "@/types";

export const DEFAULT_DEADLINE_OFFSETS = [5 * 24 * 60, 3 * 24 * 60, 24 * 60];

export function reminderFields(mode: ReminderMode, deadline?: string | null, settings?: ReminderSettings | null) {
  const reminderSettings = normalizeReminderSettings(mode, settings);
  const recurring = mode === "daily" || mode === "monthly";
  return {
    reminder_mode: mode,
    reminder_settings: reminderSettings,
    reminders_enabled: mode !== "none",
    deadline: mode === "deadline" ? deadline ?? null : null,
    next_reminder_at: recurring ? nextRecurringOccurrence(mode, reminderSettings).toISOString() : null,
  };
}

export function normalizeReminderSettings(mode: ReminderMode, settings?: ReminderSettings | null): ReminderSettings {
  if (mode === "none") return {};
  if (mode === "deadline") {
    return {
      deadline_offsets: uniqueNumbers(settings?.deadline_offsets).sort((a, b) => b - a),
    };
  }
  const recurringTime = validTime(settings?.recurring_time) ? settings?.recurring_time : "09:00";
  return {
    recurring_time: recurringTime,
    monthly_day: clamp(settings?.monthly_day ?? 1, 1, 31),
    timezone_offset_minutes: clamp(settings?.timezone_offset_minutes ?? 0, -840, 840),
  };
}

export function nextRecurringOccurrence(mode: "daily" | "monthly", settings: ReminderSettings, now = new Date()) {
  const [hour, minute] = (settings.recurring_time ?? "09:00").split(":").map(Number);
  const offset = settings.timezone_offset_minutes ?? 0;
  const localNow = new Date(now.getTime() - offset * 60000);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();
  const targetDay = mode === "monthly" ? clamp(settings.monthly_day ?? day, 1, daysInMonth(year, month)) : day;
  let candidate = localToUtc(year, month, targetDay, hour, minute, offset);
  if (candidate <= now) {
    if (mode === "daily") candidate = localToUtc(year, month, day + 1, hour, minute, offset);
    else {
      const nextMonth = month + 1;
      const nextYear = year + Math.floor(nextMonth / 12);
      const normalizedMonth = nextMonth % 12;
      candidate = localToUtc(nextYear, normalizedMonth, clamp(settings.monthly_day ?? 1, 1, daysInMonth(nextYear, normalizedMonth)), hour, minute, offset);
    }
  }
  return candidate;
}

function localToUtc(year: number, month: number, day: number, hour: number, minute: number, offset: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) + offset * 60000);
}

function uniqueNumbers(values?: number[]) {
  return Array.from(new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0 && value <= 525600)));
}

function validTime(value?: string) {
  return Boolean(value && /^\d{2}:\d{2}$/.test(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
