"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { companySchema } from "@/lib/validators";

type CompanyInput = z.infer<typeof companySchema>;

interface Company extends CompanyInput {
  id: string;
  is_active: boolean;
  created_at: string;
}

const defaults: CompanyInput = {
  name: "",
  description: "",
  max_managers: 1,
  max_collaborators: 10,
};

export function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<CompanyInput>({ resolver: zodResolver(companySchema), defaultValues: defaults });

  const loadCompanies = useCallback(async () => {
    const response = await fetch("/api/admin/companies", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las empresas");
    setCompanies(body.data ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/admin/companies", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las empresas");
        setCompanies(body.data ?? []);
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar las empresas"))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setServerError("");
    reset(defaults);
    setFormOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setServerError("");
    reset({
      name: company.name,
      description: company.description ?? "",
      max_managers: company.max_managers,
      max_collaborators: company.max_collaborators,
    });
    setFormOpen(true);
  };

  const submit = async (values: CompanyInput) => {
    const response = await fetch(editing ? `/api/admin/companies/${editing.id}` : "/api/admin/companies", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json();
    if (!response.ok) {
      setError("root", { message: body.error ?? "No se pudo guardar la empresa" });
      return;
    }
    setFormOpen(false);
    setNotice(editing ? "Empresa actualizada correctamente." : "Empresa creada correctamente.");
    await loadCompanies();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setServerError("");
    const response = await fetch(`/api/admin/companies/${deleteTarget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar la empresa");
    setNotice("Empresa y todos sus datos fueron eliminados permanentemente.");
    await loadCompanies();
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="folio !text-[var(--primary)]">ORGANIZACIONES</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Empresas</h1>
          <p className="mt-2 text-[var(--ink-soft)]">Configura empresas y sus límites de usuarios.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary !py-3">
          <Plus size={19} /> Nueva empresa
        </button>
      </div>

      {serverError && <p role="alert" className="mt-6 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-lg bg-[#E9EFEA] p-4 text-sm font-semibold text-[#4A7058]">{notice}</p>}

      <div className="card mt-7 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-[var(--ink-soft)]">Cargando empresas...</p>
        ) : companies.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto text-[var(--line-strong)]" size={38} />
            <h2 className="mt-4 font-display text-lg font-bold">Todavía no hay empresas</h2>
            <button onClick={openCreate} className="mt-4 font-bold text-[var(--primary)]">Crear la primera empresa</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-[var(--paper)] text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                <tr><th className="px-5 py-4">Empresa</th><th className="px-5 py-4">Gestores/as</th><th className="px-5 py-4">Colaboradores/as</th><th className="px-5 py-4">Creada</th><th className="px-5 py-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-[var(--paper)]">
                    <td className="px-5 py-4"><p className="font-bold text-[var(--ink)]">{company.name}</p><p className="mt-1 max-w-sm truncate text-xs text-[var(--ink-soft)]">{company.description || "Sin descripción"}</p></td>
                    <td className="px-5 py-4 font-semibold">{company.max_managers}</td>
                    <td className="px-5 py-4 font-semibold">{company.max_collaborators}</td>
                    <td className="folio px-5 py-4">{new Date(company.created_at).toLocaleDateString("es-EC")}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(company)} className="rounded-md border border-[var(--line-strong)] p-2 hover:bg-[var(--paper-deep)]" aria-label={`Editar ${company.name}`}><Pencil size={17} /></button>
                      <button onClick={() => setDeleteTarget(company)} className="rounded-md border border-[var(--stamp-red)] p-2 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label={`Eliminar ${company.name}`}><Trash2 size={17} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? "Editar empresa" : "Nueva empresa"} description="Define la empresa y los límites de su equipo." size="sm">
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label="Nombre" error={errors.name?.message}><input {...register("name")} className="input !py-2.5" /></Field>
          <Field label="Descripción" error={errors.description?.message}><textarea {...register("description")} rows={3} className="input resize-y !py-2.5" /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Máx. gestores/as" error={errors.max_managers?.message}><input type="number" min={1} max={100} {...register("max_managers", { valueAsNumber: true })} className="input !py-2.5" /></Field>
            <Field label="Máx. colaboradores/as" error={errors.max_collaborators?.message}><input type="number" min={1} max={10000} {...register("max_collaborators", { valueAsNumber: true })} className="input !py-2.5" /></Field>
          </div>
          {errors.root?.message && <p role="alert" className="rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm text-[var(--stamp-red)]">{errors.root.message}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-ghost">Cancelar</button>
            <button disabled={isSubmitting} className="btn btn-primary !px-5">{isSubmitting ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar empresa"
        description="Se eliminarán permanentemente la empresa, sus usuarios, tareas, archivos e historial."
        confirmLabel="Eliminar definitivamente"
        requiredText={deleteTarget?.name}
        onConfirm={async () => {
          try {
            await remove();
          } catch (error) {
            setServerError(error instanceof Error ? error.message : "No se pudo eliminar la empresa");
          }
        }}
      />
    </section>
  );
}
