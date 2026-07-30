"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FolderOpen, Pencil, Save, ShieldAlert, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { Field } from "@/components/ui/field";
import { profileSchema } from "@/lib/validators";

type ProfileInput = z.infer<typeof profileSchema>;
type CompanyMeta = { name: string; drive_folder_url?: string | null; drive_folder_id?: string | null; drive_folder_name?: string | null; drive_connected_at?: string | null };
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
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveSuccessOpen, setDriveSuccessOpen] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveError, setDriveError] = useState("");
  const [savingDrive, setSavingDrive] = useState(false);
  const [openingPicker, setOpeningPicker] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", email: "", current_password: "", new_password: "" },
  });

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el perfil");
        const company = currentCompany(body.data.company);
        reset({ full_name: body.data.full_name, email: body.data.email, current_password: "", new_password: "" });
        // Si la carpeta no esta realmente conectada (id vacio), no se carga el
        // nombre aunque el servidor lo devuelva: un nombre huerfano de una
        // conexion anterior no debe verse como si estuviera seleccionado.
        setDriveLink(company?.drive_folder_id ? (company?.drive_folder_url ?? "") : "");
        setDriveFolderId(company?.drive_folder_id ?? "");
        setDriveFolderName(company?.drive_folder_id ? (company?.drive_folder_name ?? "") : "");
        setMeta(body.data);
        if (body.data.must_change_password) setAccountModalOpen(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get("google") === "connected") setNotice("Google Drive conectado. Ahora configura la carpeta raiz desde el boton de Drive.");
        if (params.get("google") === "error") setServerError(params.get("reason") ?? "No se pudo conectar Google Drive.");
        if (params.get("openDrive") === "1") setDriveModalOpen(true);
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

  const saveDriveFolder = async () => {
    setDriveError("");
    if (!driveFolderId) {
      setDriveError("Elige una carpeta de Google Drive antes de guardar.");
      return;
    }
    setSavingDrive(true);
    const response = await fetch("/api/profile/drive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drive_folder_id: driveFolderId, drive_folder_url: driveLink || undefined, drive_folder_name: driveFolderName || undefined }),
    });
    const body = await response.json();
    setSavingDrive(false);
    if (!response.ok) {
      setDriveError(body.error ?? "No se pudo guardar la carpeta de Google Drive");
      return;
    }
    setMeta((current) => current ? { ...current, company: body.data } : current);
    setDriveFolderName(body.data.drive_folder_name ?? driveFolderName);
    setDriveModalOpen(false);
    setDriveSuccessOpen(true);
  };

  const openGooglePicker = async () => {
    setDriveError("");
    setOpeningPicker(true);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>((resolve) => window.gapi.load("picker", { callback: resolve }));
      const tokenResponse = await fetch("/api/google/access-token", { cache: "no-store" });
      const tokenBody = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenBody.error ?? "No se pudo obtener acceso temporal a Google");
      const configResponse = await fetch("/api/google/picker-config", { cache: "no-store" });
      const configBody = await configResponse.json();
      if (!configResponse.ok) throw new Error(configBody.error ?? "Google Picker no esta configurado");
      const folderView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder");
      const picker = new window.google.picker.PickerBuilder()
        .setAppId(configBody.appId)
        .setDeveloperKey(configBody.apiKey)
        .setOAuthToken(tokenBody.access_token)
        .addView(folderView)
        .setTitle("Selecciona la carpeta raiz de TaskKeep")
        .setCallback((data: PickerResponse) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const folder = data.docs?.[0];
            if (folder?.id) {
              // Elegir la carpeta con el Picker es lo que la autoriza para la app
              // bajo el alcance `drive.file`; por eso se envía su identificador.
              setDriveFolderId(folder.id);
              setDriveLink(folder.url || `https://drive.google.com/drive/folders/${folder.id}`);
              setDriveFolderName(folder.name ?? "Carpeta seleccionada");
            }
          }
          if (data.action === window.google.picker.Action.PICKED || data.action === window.google.picker.Action.CANCEL) {
            setPickerOpen(false);
          }
        })
        .build();
      setPickerOpen(true);
      picker.setVisible(true);
    } catch (error) {
      setPickerOpen(false);
      setDriveError(error instanceof Error ? error.message : "No se pudo abrir Google Picker");
    } finally {
      setOpeningPicker(false);
    }
  };

  const forcedChange = Boolean(meta?.must_change_password);
  const company = currentCompany(meta?.company);

  return (
    <section className="mx-auto max-w-3xl">
      <p className="folio !text-[var(--primary)]">MI CUENTA</p>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{forcedChange ? "Cambia tu contrasena temporal" : "Perfil"}</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        {forcedChange ? "Debes establecer una contrasena personal antes de usar el sistema." : "Administra tus datos, tu acceso y Google Drive desde modales separados."}
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
                  <h2 id="google-drive-heading" className="font-display text-lg font-bold">Google Drive de la empresa</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
                  Conecta tu cuenta y configura una carpeta raiz. Los colaboradores/as usaran esta misma carpeta automaticamente para subir archivos de tareas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/google/connect?return=/manager/profile" className="btn btn-ghost !px-4 !py-2.5 text-sm !text-[var(--primary)]">
                  <ExternalLink size={17} />
                  {meta.google_email ? "Reconectar Google" : "Conectar Google"}
                </a>
                <button type="button" onClick={() => setDriveModalOpen(true)} className="btn btn-primary !px-4 !py-2.5 text-sm">
                  <FolderOpen size={17} />
                  Configurar carpeta
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--ink)]">Estado: {meta.google_email ? `Conectado como ${meta.google_email}` : "Google no conectado"}</p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Carpeta: {company?.drive_folder_id ? (
                <>
                  <span className="font-semibold text-[var(--ink)]">{company.drive_folder_name || "Configurada y validada"}</span>
                  {company.drive_folder_url && <a href={company.drive_folder_url} target="_blank" rel="noreferrer" className="ml-2 underline">Abrir en Drive</a>}
                </>
              ) : "Aun no configurada"}
            </p>
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

      <AppDialog
        open={driveModalOpen}
        onOpenChange={setDriveModalOpen}
        title="Carpeta de Google Drive"
        description="Elige con Google Picker la carpeta raiz donde TaskKeep organizara los archivos aprobados."
        size="md"
        modal={!pickerOpen}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary-wash)] p-4 text-sm leading-6 text-[var(--ink)]">
            Primero conecta Google. Luego selecciona una carpeta accesible para esa cuenta. Los colaboradores/as usaran esta carpeta automaticamente al subir archivos.
          </div>
          {driveError && <p role="alert" className="rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm font-semibold text-[var(--stamp-red)]">{driveError}</p>}
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <p className="folio uppercase">Carpeta seleccionada</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{driveFolderName || (driveFolderId ? "Carpeta actual configurada" : "Todavia no has elegido una carpeta")}</p>
          </div>
          <button type="button" disabled={openingPicker} onClick={() => void openGooglePicker()} className="btn btn-ghost !px-4 !py-2.5 text-sm !text-[var(--primary)]">
            <FolderOpen size={17} />
            {openingPicker ? "Abriendo Google..." : "Elegir carpeta con Google"}
          </button>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDriveModalOpen(false)} className="btn btn-ghost !py-2">Cancelar</button>
            <button type="button" disabled={savingDrive || !driveFolderId} onClick={() => void saveDriveFolder()} className="btn btn-primary !px-5 !py-2">{savingDrive ? "Guardando..." : "Guardar carpeta"}</button>
          </div>
        </div>
      </AppDialog>

      <AppDialog open={driveSuccessOpen} onOpenChange={setDriveSuccessOpen} title="Google Drive guardado" description="La carpeta raiz fue validada y quedo conectada para la empresa." size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-[#4A7058] bg-[#E9EFEA] p-4 text-[#3a5946]">
            <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
            <p className="text-sm font-semibold">Listo. Los archivos aprobados se organizaran dentro de la carpeta configurada.</p>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setDriveSuccessOpen(false)} className="btn !bg-[#4A7058] !px-5 !py-2 text-white hover:!bg-[#3a5946]">Entendido</button>
          </div>
        </div>
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

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Picker"));
    document.body.appendChild(script);
  });
}

type PickerResponse = { action: string; docs?: Array<{ id: string; name?: string; url?: string }> };

declare global {
  interface Window {
    gapi: { load: (name: string, options: { callback: () => void }) => void };
    google: {
      picker: {
        Action: { PICKED: string; CANCEL: string };
        ViewId: { FOLDERS: string };
        DocsView: new (viewId: string) => {
          setIncludeFolders: (value: boolean) => Window["google"]["picker"]["DocsView"]["prototype"];
          setSelectFolderEnabled: (value: boolean) => Window["google"]["picker"]["DocsView"]["prototype"];
          setMimeTypes: (value: string) => Window["google"]["picker"]["DocsView"]["prototype"];
        };
        PickerBuilder: new () => {
          setAppId: (value: string) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          setDeveloperKey: (value: string) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          setOAuthToken: (value: string) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          addView: (value: unknown) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          setTitle: (value: string) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          setCallback: (callback: (data: PickerResponse) => void) => Window["google"]["picker"]["PickerBuilder"]["prototype"];
          build: () => { setVisible: (value: boolean) => void };
        };
      };
    };
  }
}
