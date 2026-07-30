"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen, Pencil, Save, ShieldAlert, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { Field } from "@/components/ui/field";
import { profileSchema } from "@/lib/validators";

type ProfileInput = z.infer<typeof profileSchema>;
type CompanyMeta = { name: string };
type ProfileMeta = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "manager" | "collaborator";
  created_at: string;
  must_change_password: boolean;
  google_email?: string | null;
  google_connected_at?: string | null;
  company?: CompanyMeta | CompanyMeta[] | null;
};

export function ProfileManager() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [meta, setMeta] = useState<ProfileMeta | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", email: "", current_password: "", new_password: "" },
  });

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el perfil");
        reset({ full_name: body.data.full_name, email: body.data.email, current_password: "", new_password: "" });
        setMeta(body.data);
        if (body.data.must_change_password) setAccountModalOpen(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get("google") === "connected") setNotice("Google Drive conectado.");
        if (params.get("google") === "error") setServerError(params.get("reason") ?? "No se pudo conectar Google Drive.");
      })
      .catch((reason: unknown) => setServerError(reason instanceof Error ? reason.message : "No se pudo cargar el perfil"));
  }, [reset]);

  const submitAccount = async (values: ProfileInput) => {
    setNotice("");
    setServerError("");

    if (meta?.must_change_password && !values.new_password) {
      setError("new_password", { message: "Debes crear una nueva contrasena" });
      return;
    }
    if (values.new_password && !values.current_password) {
      setError("current_password", { message: "Ingresa tu contrasena actual" });
      return;
    }
    if (values.new_password !== confirmation) {
      setServerError("La confirmacion no coincide con la nueva contrasena");
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
    reset({ full_name: body.data.full_name, email: body.data.email, current_password: "", new_password: "" });
    setConfirmation("");
    setMeta(body.data);
    setAccountModalOpen(false);

    if (wasTemporary) {
      router.replace(`/${body.data.role}/dashboard`);
      router.refresh();
      return;
    }
    setNotice(values.new_password ? "Perfil y contrasena actualizados." : "Perfil actualizado correctamente.");
  };

  const forcedChange = Boolean(meta?.must_change_password);

  return (
    <section className="mx-auto max-w-3xl">
      <p className="folio !text-[var(--primary)]">MI CUENTA</p>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{forcedChange ? "Cambia tu contrasena temporal" : "Perfil"}</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        {forcedChange ? "Debes establecer una contrasena personal antes de usar el sistema." : "Administra tus datos, tu acceso y tu Google Drive."}
      </p>

      {forcedChange && (
        <div className="mt-6 flex gap-3 rounded-lg border border-[#9A7B24] bg-[#F3EDDC] p-4 text-[#6b5619]">
          <ShieldAlert className="mt-0.5 shrink-0" size={22} />
          <div>
            <p className="font-bold">Cambio obligatorio</p>
            <p className="mt-1 text-sm">Por seguridad, las demas funciones permaneceran bloqueadas hasta completar este paso.</p>
          </div>
        </div>
      )}
      {serverError && <p role="alert" className="mt-6 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-lg bg-[#E9EFEA] p-4 text-sm font-semibold text-[#4A7058]">{notice}</p>}

      <div className="card mt-7 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-[var(--primary-wash)] p-4 text-[var(--primary)]"><UserRound size={28} /></span>
            <div>
              <p className="font-bold">{meta?.full_name ?? "Usuario"}</p>
              <p className="text-sm text-[var(--ink-soft)]">{meta?.email ?? "..."}</p>
              <p className="folio mt-1">{roleLabel(meta?.role)} · {profileCompany(meta?.company)} · Cuenta desde {meta ? new Date(meta.created_at).toLocaleDateString("es-EC") : "..."}</p>
            </div>
          </div>
          <button type="button" onClick={() => setAccountModalOpen(true)} className="btn btn-primary !px-4 !py-2.5 text-sm">
            <Pencil size={17} />
            Cambiar correo o contrasena
          </button>
        </div>

        {meta?.role === "manager" && (
          <section className="mt-7 rounded-lg border border-[var(--primary)] bg-[var(--primary-wash)] p-5" aria-labelledby="google-drive-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <FolderOpen className="text-[var(--primary)]" size={21} />
                  <h2 id="google-drive-heading" className="font-display text-lg font-bold">Tu Google Drive</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
                  Conecta tu propia cuenta de Google. Es independiente de la de otros/as gestores/as de tu empresa. La carpeta de cada tarea se crea o se elige por separado, desde la propia tarea.
                </p>
              </div>
              <a href="/api/google/connect?return=/manager/profile" className="btn btn-ghost !px-4 !py-2.5 text-sm !text-[var(--primary)]">
                <ExternalLink size={17} />
                {meta.google_email ? "Reconectar Google" : "Conectar Google"}
              </a>
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--ink)]">Estado: {meta.google_email ? `Conectado como ${meta.google_email}` : "Google no conectado"}</p>
          </section>
        )}
      </div>

      <AppDialog open={accountModalOpen} onOpenChange={(open) => !forcedChange && setAccountModalOpen(open)} title={forcedChange ? "Cambia tu contrasena" : "Correo y contrasena"} description={forcedChange ? "Debes cambiar tu contrasena temporal para continuar." : "Actualiza tu correo o cambia tu contrasena de acceso."} size="md">
        <form onSubmit={handleSubmit(submitAccount)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" error={errors.full_name?.message}>
              <input {...register("full_name")} readOnly={forcedChange} autoComplete="name" className="input !py-2.5 read-only:bg-[var(--paper-deep)]" />
            </Field>
            <Field label="Correo electronico" error={errors.email?.message}>
              <input type="email" {...register("email")} readOnly={forcedChange} autoComplete="email" className="input !py-2.5 read-only:bg-[var(--paper-deep)]" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contrasena actual" error={errors.current_password?.message}>
              <input type="password" {...register("current_password")} autoComplete="current-password" className="input !py-2.5" />
            </Field>
            <Field label="Nueva contrasena" error={errors.new_password?.message}>
              <input type="password" {...register("new_password")} autoComplete="new-password" className="input !py-2.5" />
            </Field>
            <Field label="Confirmar contrasena">
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="input !py-2.5" />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            {!forcedChange && <button type="button" onClick={() => setAccountModalOpen(false)} className="btn btn-ghost !py-2">Cancelar</button>}
            <button disabled={isSubmitting} className="btn btn-primary !px-5 !py-2">
              <Save size={18} />
              {isSubmitting ? "Guardando..." : forcedChange ? "Cambiar contrasena y continuar" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </AppDialog>
    </section>
  );
}

function currentCompany(company: CompanyMeta | CompanyMeta[] | null | undefined) {
  return Array.isArray(company) ? company[0] : company;
}

function profileCompany(company: CompanyMeta | CompanyMeta[] | null | undefined) {
  return currentCompany(company)?.name ?? "TaskKeep";
}

function roleLabel(role: ProfileMeta["role"] | undefined) {
  if (role === "admin") return "Administrador";
  if (role === "manager") return "Gestor/a";
  return "Colaborador/a";
}
