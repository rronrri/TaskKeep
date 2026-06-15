"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen, KeyRound, Save, ShieldAlert, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Field } from "@/components/ui/field";
import { profileSchema } from "@/lib/validators";

type ProfileInput = z.infer<typeof profileSchema>;
type ProfileMeta = {
  role: "admin" | "manager" | "collaborator";
  created_at: string;
  must_change_password: boolean;
  google_email?: string | null;
  google_connected_at?: string | null;
  company?: { name: string; drive_folder_url?: string | null; drive_folder_id?: string | null; drive_connected_at?: string | null } | Array<{ name: string; drive_folder_url?: string | null; drive_folder_id?: string | null; drive_connected_at?: string | null }> | null;
};

export function ProfileManager() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [meta, setMeta] = useState<ProfileMeta | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", email: "", current_password: "", new_password: "", drive_folder_url: "" },
  });

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el perfil");
        const company = Array.isArray(body.data.company) ? body.data.company[0] : body.data.company;
        reset({ full_name: body.data.full_name, email: body.data.email, current_password: "", new_password: "", drive_folder_url: company?.drive_folder_url ?? "" });
        setMeta(body.data);
        const params = new URLSearchParams(window.location.search);
        if (params.get("google") === "connected") setNotice("Google Drive conectado. Ahora puedes pegar el enlace de la carpeta raíz.");
        if (params.get("google") === "error") setServerError(params.get("reason") ?? "No se pudo conectar Google Drive.");
      })
      .catch((reason: unknown) => setServerError(reason instanceof Error ? reason.message : "No se pudo cargar el perfil"));
  }, [reset]);

  const submit = async (values: ProfileInput) => {
    setNotice("");
    setServerError("");

    if (meta?.must_change_password && !values.new_password) {
      setError("new_password", { message: "Debes crear una nueva contraseña" });
      return;
    }
    if (values.new_password && !values.current_password) {
      setError("current_password", { message: "Ingresa tu contraseña actual" });
      return;
    }
    if (values.new_password !== confirmation) {
      setServerError("La confirmación no coincide con la nueva contraseña");
      return;
    }

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo guardar el perfil");
      return;
    }

    const wasTemporary = meta?.must_change_password;
    reset({ full_name: body.data.full_name, email: body.data.email, current_password: "", new_password: "", drive_folder_url: values.drive_folder_url ?? "" });
    setConfirmation("");
    setMeta((current) => current ? { ...current, must_change_password: false } : current);

    if (wasTemporary) {
      router.replace(`/${body.data.role}/dashboard`);
      router.refresh();
      return;
    }
    setNotice(values.new_password ? "Perfil y contraseña actualizados." : "Perfil actualizado correctamente.");
  };

  const forcedChange = Boolean(meta?.must_change_password);

  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-sm font-bold text-indigo-600">MI CUENTA</p>
      <h1 className="font-display text-3xl font-extrabold">
        {forcedChange ? "Cambia tu contraseña temporal" : "Perfil"}
      </h1>
      <p className="mt-2 text-slate-600">
        {forcedChange
          ? "Debes establecer una contraseña personal antes de usar el sistema."
          : "Actualiza tus datos personales y tu contraseña de acceso."}
      </p>

      {forcedChange && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <ShieldAlert className="mt-0.5 shrink-0" size={22} />
          <div>
            <p className="font-bold">Cambio obligatorio</p>
            <p className="mt-1 text-sm">Por seguridad, las demás funciones permanecerán bloqueadas hasta completar este paso.</p>
          </div>
        </div>
      )}
      {serverError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

      <form onSubmit={handleSubmit(submit)} className="card mt-7 p-6" noValidate>
        <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-5">
          <span className="rounded-2xl bg-indigo-100 p-4 text-indigo-700"><UserRound size={28} /></span>
          <div>
            <p className="font-bold">{roleLabel(meta?.role)}</p>
            <p className="text-sm text-slate-500">
              {profileCompany(meta?.company)} · Cuenta desde {meta ? new Date(meta.created_at).toLocaleDateString("es-EC") : "..."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" error={errors.full_name?.message}>
            <input {...register("full_name")} readOnly={forcedChange} autoComplete="name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 read-only:bg-slate-100" />
          </Field>
          <Field label="Correo electrónico" error={errors.email?.message}>
            <input type="email" {...register("email")} readOnly={forcedChange} autoComplete="email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 read-only:bg-slate-100" />
          </Field>
        </div>

        {meta?.role === "manager" && (
          <section className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/60 p-5" aria-labelledby="google-drive-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <FolderOpen className="text-blue-700" size={21} />
                  <h2 id="google-drive-heading" className="font-display text-lg font-extrabold">Google Drive de la empresa</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Conecta tu cuenta y pega una carpeta raíz. Los colaboradores/as usarán esta misma carpeta automáticamente para subir archivos de tareas.
                </p>
              </div>
              <a href="/api/google/connect?return=/manager/profile" className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-100">
                <ExternalLink size={17} />
                {meta.google_email ? "Reconectar Google" : "Conectar Google"}
              </a>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              Estado: {meta.google_email ? `Conectado como ${meta.google_email}` : "Google no conectado"}
            </p>
            <div className="mt-4">
              <Field label="Enlace de carpeta raíz de Drive" error={errors.drive_folder_url?.message}>
                <input type="url" {...register("drive_folder_url")} placeholder="https://drive.google.com/drive/folders/..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" />
              </Field>
              <p className="mt-2 text-xs text-slate-600">
                Abre tu carpeta en Drive, copia el enlace y pégalo aquí. Primero debes conectar Google para que TaskKeep pueda validar y organizar los archivos.
              </p>
            </div>
          </section>
        )}

        <div className="mt-7 flex items-center gap-2">
          <KeyRound className="text-indigo-600" size={20} />
          <h2 className="font-display text-lg font-extrabold">Cambiar contraseña</h2>
        </div>
        {!forcedChange && <p className="mt-1 text-sm text-slate-500">Déjala vacía si solo deseas actualizar tus datos.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Contraseña actual" error={errors.current_password?.message}>
            <input type="password" {...register("current_password")} autoComplete="current-password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </Field>
          <Field label="Nueva contraseña" error={errors.new_password?.message}>
            <input type="password" {...register("new_password")} autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </Field>
          <Field label="Confirmar contraseña">
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button disabled={isSubmitting} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-60">
            <Save size={18} />
            {isSubmitting ? "Guardando..." : forcedChange ? "Cambiar contraseña y continuar" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </section>
  );
}

function profileCompany(company: { name: string } | { name: string }[] | null | undefined) {
  if (Array.isArray(company)) return company[0]?.name ?? "TaskKeep";
  return company?.name ?? "TaskKeep";
}

function roleLabel(role: ProfileMeta["role"] | undefined) {
  if (role === "admin") return "Administrador";
  if (role === "manager") return "Gestor/a";
  return "Colaborador/a";
}
