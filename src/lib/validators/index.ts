import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido").max(254),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  max_managers: z.number().int().min(1).max(100),
  max_collaborators: z.number().int().min(1).max(10000),
});

export const userSchema = z.object({
  company_id: z.string().uuid().nullable(),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "manager", "collaborator"]),
});

export const updateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.union([z.string().min(8).max(128), z.literal("")]).optional(),
});

const reminderModeSchema = z.enum(["none", "daily", "monthly", "deadline"]);
const reminderSettingsSchema = z.object({
  deadline_offsets: z.array(z.number().int().min(1).max(525600)).max(20).optional(),
  recurring_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  monthly_day: z.number().int().min(1).max(31).optional(),
  timezone_offset_minutes: z.number().int().min(-840).max(840).optional(),
}).default({});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  responsible_id: z.string().uuid(),
  deadline: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
  is_pinned: z.boolean().default(false),
  folder_id: z.string().uuid().nullable().optional(),
  drive_folder_id: z.string().trim().min(10).max(200).optional(),
  reminder_mode: reminderModeSchema.default("none"),
  reminder_settings: reminderSettingsSchema,
}).superRefine((value, context) => {
  if (value.reminder_mode === "deadline" && !value.deadline) {
    context.addIssue({ code: "custom", path: ["deadline"], message: "Selecciona una fecha límite" });
  }
  if (value.reminder_mode === "deadline" && !value.reminder_settings.deadline_offsets?.length) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Configura al menos un aviso" });
  }
  if (value.reminder_mode === "deadline" && value.deadline && value.reminder_settings.deadline_offsets?.some((offset) => offset * 60000 >= new Date(value.deadline!).getTime() - Date.now())) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Los avisos deben ocurrir antes de la fecha limite y despues del momento actual" });
  }
  if ((value.reminder_mode === "daily" || value.reminder_mode === "monthly") && !value.reminder_settings.recurring_time) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Selecciona una hora para el recordatorio" });
  }
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  responsible_id: z.string().uuid().optional(),
  deadline: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  is_pinned: z.boolean().optional(),
  drive_folder_id: z.string().trim().min(10).max(200).nullable().optional(),
  reminder_mode: reminderModeSchema.optional(),
  reminder_settings: reminderSettingsSchema.optional(),
}).superRefine((value, context) => {
  if (value.reminder_mode === "deadline" && !value.deadline) {
    context.addIssue({ code: "custom", path: ["deadline"], message: "Selecciona una fecha límite" });
  }
  if (value.reminder_mode === "deadline" && !value.reminder_settings?.deadline_offsets?.length) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Configura al menos un aviso" });
  }
  if (value.reminder_mode === "deadline" && value.deadline && value.reminder_settings?.deadline_offsets?.some((offset) => offset * 60000 >= new Date(value.deadline!).getTime() - Date.now())) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Los avisos deben ocurrir antes de la fecha limite y despues del momento actual" });
  }
  if ((value.reminder_mode === "daily" || value.reminder_mode === "monthly") && !value.reminder_settings?.recurring_time) {
    context.addIssue({ code: "custom", path: ["reminder_settings"], message: "Selecciona una hora para el recordatorio" });
  }
});

export const statusRequestSchema = z.object({
  requested_status: z.enum(["pending", "in_progress", "completed"]),
});

export const reviewStatusSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  manager_comment: z.string().trim().max(1000).optional(),
});

export const taskCommentSchema = z.object({
  comment: z.string().trim().min(1, "Escribe un comentario").max(2000),
});

export const fileReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(1000).optional(),
  drive_folder_id: z.string().trim().min(1).optional(),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo").max(120),
  email: z.string().email("Ingresa un correo válido").max(254),
  current_password: z.string().max(128),
  new_password: z.union([z.string().min(8, "Usa al menos 8 caracteres").max(128), z.literal("")]),
});
