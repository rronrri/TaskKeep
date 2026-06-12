"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Search, UserRound } from "lucide-react";
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
interface Person { id: string; company_id: string; full_name: string; email: string; role: "manager" | "collaborator"; is_active: boolean; created_at: string; company?: { name: string } | { name: string }[] | null; }
interface Company { id: string; name: string; }
interface Session { id: string; companyId: string | null; role: "admin" | "manager" | "collaborator"; }

const emptyValues: PersonInput = { full_name: "", email: "", password: "", company_id: "", role: "collaborator" };

export function PeopleManager({ mode }: { mode: "admin" | "manager" }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Person | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
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
    Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
      mode === "admin" ? fetch("/api/admin/companies", { cache: "no-store" }) : Promise.resolve(null),
    ])
      .then(async ([peopleResponse, meResponse, companiesResponse]) => {
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
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [mode]);

  const baseValues = useCallback((): PersonInput => ({
    ...emptyValues,
    company_id: mode === "manager" ? session?.companyId ?? "" : "",
    role: "collaborator",
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

  const deactivate = async () => {
    if (!deactivateTarget) return;
    const response = await fetch(`/api/admin/users/${deactivateTarget.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo desactivar la cuenta");
    setNotice("Cuenta desactivada correctamente.");
    await load();
  };

  const reactivate = async (person: Person) => {
    const response = await fetch(`/api/admin/users/${person.id}/activate`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo reactivar la cuenta");
      return;
    }
    setNotice("Cuenta reactivada correctamente.");
    await load();
  };

  const visiblePeople = people.filter((person) => {
    const matchesSearch = !search.trim() || `${person.full_name} ${person.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || person.role === roleFilter;
    const matchesActive = !activeFilter || String(person.is_active) === activeFilter;
    return matchesSearch && matchesRole && matchesActive;
  });

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-indigo-600">EQUIPO</p>
          <h1 className="font-display text-3xl font-extrabold">{mode === "admin" ? "Personas" : "Colaboradores"}</h1>
          <p className="mt-2 text-slate-600">{mode === "admin" ? "Crea gestoras y colaboradoras, y asígnalas a una empresa." : "Crea y administra las colaboradoras de tu empresa."}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"><Plus size={19} /> Nueva cuenta</button>
      </div>

      {serverError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo…" className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm" /></div>
        {mode === "admin" && <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todos los roles</option><option value="manager">Gestoras</option><option value="collaborator">Colaboradoras</option></select>}
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todos los estados</option><option value="true">Activas</option><option value="false">Desactivadas</option></select>
      </div>
      <div className="card mt-7 overflow-hidden">
        {loading ? <p className="p-8 text-center text-slate-500">Cargando personas...</p> : people.length === 0 ? (
          <div className="p-10 text-center"><UserRound className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-bold">No hay cuentas todavía.</p><button onClick={openCreate} className="mt-3 font-bold text-indigo-700">Crear la primera cuenta</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Persona</th><th className="px-5 py-4">Empresa</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Alta</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {visiblePeople.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4"><p className="font-bold">{person.full_name}</p><p className="text-xs text-slate-500">{person.email}</p>{!person.is_active && <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Desactivada</span>}</td>
                    <td className="px-5 py-4">{companyName(person.company)}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{person.role === "manager" ? "Gestora" : "Colaboradora"}</span></td>
                    <td className="px-5 py-4 text-slate-600">{new Date(person.created_at).toLocaleDateString("es-EC")}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(person)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100" aria-label={`Editar ${person.full_name}`}><Pencil size={17} /></button>
                      {person.is_active ? <button onClick={() => setDeactivateTarget(person)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50" aria-label={`Desactivar ${person.full_name}`}><Power size={17} /></button> : <button onClick={() => void reactivate(person)} className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50" aria-label={`Reactivar ${person.full_name}`}><RotateCcw size={17} /></button>}
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
          <Field label="Nombre completo" error={errors.full_name?.message}><input {...register("full_name")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label="Correo" error={errors.email?.message}><input type="email" {...register("email")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label={editing ? "Nueva contraseña" : "Contraseña temporal"} error={errors.password?.message}><input type="password" {...register("password")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder={editing ? "Déjala vacía para conservarla" : "Mínimo 8 caracteres"} /></Field>
          {!editing && mode === "admin" && <>
            <Field label="Empresa" error={errors.company_id?.message}><select {...register("company_id")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="">Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
            <Field label="Rol" error={errors.role?.message}><select {...register("role")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="manager">Gestora</option><option value="collaborator">Colaboradora</option></select></Field>
          </>}
          {errors.root?.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 font-bold">Cancelar</button>
            <button disabled={isSubmitting} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white disabled:opacity-60">{isSubmitting ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Desactivar cuenta"
        description={`La cuenta de ${deactivateTarget?.full_name ?? "esta persona"} ya no podrá acceder al sistema.`}
        confirmLabel="Desactivar"
        onConfirm={async () => {
          try { await deactivate(); }
          catch (error) { setServerError(error instanceof Error ? error.message : "No se pudo desactivar la cuenta"); }
        }}
      />
    </section>
  );
}

function companyName(company: Person["company"]) {
  if (Array.isArray(company)) return company[0]?.name ?? "Sin empresa";
  return company?.name ?? "Sin empresa";
}
