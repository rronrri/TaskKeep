"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
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
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: defaults,
  });

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setServerError("");
    try {
      const response = await fetch("/api/admin/companies", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las empresas");
      setCompanies(body.data ?? []);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No se pudieron cargar las empresas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/companies", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las empresas");
        setCompanies(body.data ?? []);
      })
      .catch((error: unknown) => {
        setServerError(error instanceof Error ? error.message : "No se pudieron cargar las empresas");
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (values: CompanyInput) => {
    setServerError("");
    setNotice("");
    const response = await fetch(
      editing ? `/api/admin/companies/${editing.id}` : "/api/admin/companies",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo guardar la empresa");
      return;
    }
    setNotice(editing ? "Empresa actualizada correctamente." : "Empresa creada correctamente.");
    setEditing(null);
    reset(defaults);
    await loadCompanies();
  };

  const startEditing = (company: Company) => {
    setEditing(company);
    setNotice("");
    setServerError("");
    reset({
      name: company.name,
      description: company.description ?? "",
      max_managers: company.max_managers,
      max_collaborators: company.max_collaborators,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditing = () => {
    setEditing(null);
    reset(defaults);
  };

  const remove = async (company: Company) => {
    const confirmation = window.prompt(
      `Esta acción eliminará permanentemente la empresa, sus usuarios, tareas, archivos e historial.\n\nEscribe "${company.name}" para confirmar:`,
    );
    if (confirmation !== company.name) {
      if (confirmation !== null) setServerError("El nombre no coincide. La empresa no fue eliminada.");
      return;
    }
    setServerError("");
    setNotice("");
    const response = await fetch(`/api/admin/companies/${company.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo eliminar la empresa");
      return;
    }
    if (editing?.id === company.id) cancelEditing();
    setNotice("Empresa y todos sus datos fueron eliminados permanentemente.");
    await loadCompanies();
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-indigo-600">ORGANIZACIONES</p>
          <h1 className="font-display text-3xl font-extrabold">Empresas</h1>
          <p className="mt-2 text-slate-600">Configura empresas y sus límites de usuarios.</p>
        </div>
        <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          {companies.length} empresa{companies.length === 1 ? "" : "s"} activa{companies.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit(submit)} className="card h-fit p-6" noValidate>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                {editing ? <Pencil size={20} /> : <Plus size={20} />}
              </span>
              <h2 className="font-display text-xl font-extrabold">
                {editing ? "Editar empresa" : "Nueva empresa"}
              </h2>
            </div>
            {editing && (
              <button type="button" onClick={cancelEditing} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cancelar edición">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="space-y-4">
            <Field label="Nombre" error={errors.name?.message}>
              <input {...register("name")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Ej. Empresa Andina" />
            </Field>
            <Field label="Descripción" error={errors.description?.message}>
              <textarea {...register("description")} rows={3} className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Descripción opcional" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Máx. gestores" error={errors.max_managers?.message}>
                <input type="number" min={1} max={100} {...register("max_managers", { valueAsNumber: true })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </Field>
              <Field label="Máx. colaboradores" error={errors.max_collaborators?.message}>
                <input type="number" min={1} max={10000} {...register("max_collaborators", { valueAsNumber: true })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
              </Field>
            </div>
          </div>

          <button disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {isSubmitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear empresa"}
          </button>
        </form>

        <div className="min-w-0">
          {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
          {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}

          <div className="card overflow-hidden">
            {loading ? (
              <p className="p-8 text-center text-slate-500">Cargando empresas...</p>
            ) : companies.length === 0 ? (
              <div className="p-10 text-center">
                <Building2 className="mx-auto text-slate-300" size={38} />
                <h2 className="mt-4 font-display text-lg font-extrabold">Todavía no hay empresas</h2>
                <p className="mt-1 text-sm text-slate-500">Crea la primera usando el formulario.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Empresa</th>
                      <th className="px-5 py-4">Gestores</th>
                      <th className="px-5 py-4">Colaboradores</th>
                      <th className="px-5 py-4">Creada</th>
                      <th className="px-5 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {companies.map((company) => (
                      <tr key={company.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{company.name}</p>
                          <p className="mt-1 max-w-sm truncate text-xs text-slate-500">{company.description || "Sin descripción"}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold">{company.max_managers}</td>
                        <td className="px-5 py-4 font-semibold">{company.max_collaborators}</td>
                        <td className="px-5 py-4 text-slate-600">{new Date(company.created_at).toLocaleDateString("es-EC")}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEditing(company)} className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-100" aria-label={`Editar ${company.name}`}>
                              <Pencil size={17} />
                            </button>
                            <button onClick={() => void remove(company)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50" aria-label={`Eliminar ${company.name}`}>
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span className="mb-2 block">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
