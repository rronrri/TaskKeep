"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppDialog } from "@/components/ui/app-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";

const formSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa el nombre completo").max(120),
  email: z.string().email("Ingresa un correo válido").max(254),
  password: z.union([z.string().min(8, "Usa al menos 8 caracteres").max(128), z.literal("")]),
  company_id: z.string().uuid("Selecciona una empresa"),
  role: z.enum(["manager", "collaborator"]),
});

type PersonInput = z.infer<typeof formSchema>;
interface Person { id: string; company_id: string; full_name: string; email: string; role: "manager" | "collaborator"; created_at: string; company?: { name: string } | { name: string }[] | null; }
interface Company { id: string; name: string; }
interface Session { id: string; companyId: string | null; role: "admin" | "manager" | "collaborator"; }

const emptyValues: PersonInput = { full_name: "", email: "", password: "", company_id: "", role: "collaborator" };

export function PeopleManager({ mode }: { mode: "admin" | "manager" }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<PersonInput>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const load = useCallback(async () => {
    const [peopleResponse, meResponse, companiesResponse] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
      mode === "admin" ? fetch("/api/admin/companies", { cache: "no-store" }) : Promise.resolve(null),
    ]);
    const peopleBody = await peopleResponse.json();
    const meBody = await meResponse.json();
    if (!peopleResponse.ok) throw new Error(peopleBody.error ?? "No se pudieron cargar las personas");
    if (!meResponse.ok) throw new Error(meBody.error ?? "No se pudo cargar la sesión");
    setPeople(peopleBody.data ?? []);
    setSession(meBody.user);
    if (companiesResponse) {
      const companiesBody = await companiesResponse.json();
      if (!companiesResponse.ok) throw new Error(companiesBody.error ?? "No se pudieron cargar las empresas");
      setCompanies(companiesBody.data ?? []);
    }
  }, [mode]);

  useEffect(() => {
    // Initial synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [load]);

  const baseValues = useCallback((): PersonInput => ({
    ...emptyValues,
    company_id: mode === "manager" ? session?.companyId ?? "" : "",
  }), [mode, session?.companyId]);

  const openCreate = () => {
    setEditing(null);
    reset(baseValues());
    setFormOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditing(person);
    reset({ full_name: person.full_name, email: person.email, password: "", company_id: person.company_id, role: person.role });
    setFormOpen(true);
  };

  const submit = async (values: PersonInput) => {
    if (!editing && !values.password) {
      setError("password", { message: "La contraseña temporal es obligatoria." });
      return;
    }
    const payload = editing
      ? { full_name: values.full_name, email: values.email, password: values.password }
      : { ...values, company_id: mode === "manager" ? session?.companyId : values.company_id, role: mode === "manager" ? "collaborator" : values.role };
    const response = await fetch(editing ? `/api/admin/users/${editing.id}` : "/api/admin/users", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setError("root", { message: body.error ?? "No se pudo guardar la cuenta" });
      return;
    }
    setFormOpen(false);
    if (editing) setNotice("Cuenta actualizada correctamente.");
    else if (body.emailDelivery?.sent) setNotice("Cuenta creada y correo de acceso enviado correctamente.");
    else setNotice(`Cuenta creada, pero el correo no se pudo enviar: ${body.emailDelivery?.reason ?? "revisa la configuración de Resend"}`);
    await load();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const response = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar la cuenta");
    setNotice("Cuenta eliminada definitivamente.");
    await load();
  };

  const visiblePeople = people.filter((person) => {
    const matchesSearch = !search.trim() || `${person.full_name} ${person.email}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!roleFilter || person.role === roleFilter);
  });

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="folio !text-[var(--primary)]">EQUIPO</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{mode === "admin" ? "Personas" : "Colaboradores/as"}</h1>
          <p className="mt-2 text-[var(--ink-soft)]">{mode === "admin" ? "Crea gestores/as y colaboradores/as, y asígnalos/as a una empresa." : "Crea y administra colaboradores/as de tu empresa."}</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary !py-3"><Plus size={19} /> Nueva cuenta</button>
      </div>

      {serverError && <p role="alert" className="mt-6 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-lg bg-[#E9EFEA] p-4 text-sm font-semibold text-[#4A7058]">{notice}</p>}
      <div className="card mt-6 flex flex-wrap gap-2 p-3">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 text-[var(--line-strong)]" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo…" className="input !py-2 !pl-10 !pr-3 text-sm" /></div>
        {mode === "admin" && <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="input !w-auto !py-2 text-sm"><option value="">Todos los roles</option><option value="manager">Gestores/as</option><option value="collaborator">Colaboradores/as</option></select>}
      </div>
      <div className="card mt-7 overflow-hidden">
        {loading ? <p className="p-8 text-center text-[var(--ink-soft)]">Cargando personas...</p> : visiblePeople.length === 0 ? (
          <div className="p-10 text-center"><UserRound className="mx-auto text-[var(--line-strong)]" size={38} /><p className="mt-4 font-bold">No hay cuentas para mostrar.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--paper)] text-xs uppercase text-[var(--ink-soft)]"><tr><th className="px-5 py-4">Persona</th><th className="px-5 py-4">Empresa</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Alta</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-[var(--line)]">
                {visiblePeople.map((person) => (
                  <tr key={person.id} className="hover:bg-[var(--paper)]">
                    <td className="px-5 py-4"><p className="font-bold">{person.full_name}</p><p className="text-xs text-[var(--ink-soft)]">{person.email}</p></td>
                    <td className="px-5 py-4">{companyName(person.company)}</td>
                    <td className="px-5 py-4"><span className={person.role === "manager" ? "stamp stamp-primary" : "stamp stamp-neutral"}>{person.role === "manager" ? "Gestor/a" : "Colaborador/a"}</span></td>
                    <td className="folio px-5 py-4">{new Date(person.created_at).toLocaleDateString("es-EC")}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(person)} className="rounded-md border border-[var(--line-strong)] p-2 hover:bg-[var(--paper-deep)]" aria-label={`Editar ${person.full_name}`}><Pencil size={17} /></button>
                      <button onClick={() => setDeleteTarget(person)} className="rounded-md border border-[var(--stamp-red)] p-2 text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" aria-label={`Eliminar ${person.full_name}`}><Trash2 size={17} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AppDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? "Editar cuenta" : "Nueva cuenta"} description="Configura los datos de acceso y la asignación de la persona." size="sm">
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label="Nombre completo" error={errors.full_name?.message}><input {...register("full_name")} className="input !py-2.5" /></Field>
          <Field label="Correo" error={errors.email?.message}><input type="email" {...register("email")} className="input !py-2.5" /></Field>
          <Field label={editing ? "Nueva contraseña" : "Contraseña temporal"} error={errors.password?.message}><input type="password" {...register("password")} className="input !py-2.5" placeholder={editing ? "Déjala vacía para conservarla" : "Mínimo 8 caracteres"} /></Field>
          {!editing && mode === "admin" && <>
            <Field label="Empresa" error={errors.company_id?.message}><select {...register("company_id")} className="input !py-2.5"><option value="">Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
            <Field label="Rol" error={errors.role?.message}><select {...register("role")} className="input !py-2.5"><option value="manager">Gestor/a</option><option value="collaborator">Colaborador/a</option></select></Field>
          </>}
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
        title="Eliminar cuenta definitivamente"
        description={`Se eliminará la cuenta de ${deleteTarget?.full_name ?? "esta persona"} y sus tareas relacionadas. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cuenta"
        requiredText={deleteTarget?.email}
        onConfirm={async () => {
          try { await remove(); }
          catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo eliminar la cuenta"); }
        }}
      />
    </section>
  );
}

function companyName(company: Person["company"]) {
  if (Array.isArray(company)) return company[0]?.name ?? "Sin empresa";
  return company?.name ?? "Sin empresa";
}
