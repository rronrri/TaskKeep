import type { ReminderMode } from "@/types";

export function reminderFields(mode: ReminderMode, deadline?: string | null) {
  const recurring = mode === "daily" || mode === "monthly";
  return {
    reminder_mode: mode,
    reminders_enabled: mode !== "none",
    deadline: mode === "deadline" ? deadline ?? null : null,
    next_reminder_at: recurring ? new Date().toISOString() : null,
  };
}
