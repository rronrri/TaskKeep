"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Power, UserRound, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa el nombre completo").max(120),
  email: z.string().email("Ingresa un correo válido").max(254),
  password: z.union([z.string().min(8, "Usa al menos 8 caracteres").max(128), z.literal("")]),
  company_id: z.string().uuid("Selecciona una empresa"),
  role: z.enum(["manager", "collaborator"]),
});

type PersonInput = z.infer<typeof formSchema>;

interface Person {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  role: "manager" | "collaborator";
  is_active: boolean;
  created_at: string;
  company?: { name: string } | { name: string }[] | null;
}

interface Company {
  id: string;
  name: string;
}

interface Session {
  id: string;
  companyId: string | null;
  role: "admin" | "manager" | "collaborator";
}

const emptyValues: PersonInput = {
  full_name: "",
  email: "",
  password: "",
  company_id: "",
  role: "collaborator",
};

export function PeopleManager({ mode }: { mode: "admin" | "manager" }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PersonInput>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  const load = async () => {
    const [peopleResponse, meResponse, companiesResponse] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
      mode === "admin"
        ? fetch("/api/admin/companies", { cache: "no-store" })
        : Promise.resolve(null),
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
    } else if (meBody.user.companyId) {
      setValue("company_id", meBody.user.companyId);
      setValue("role", "collaborator");
    }
  };

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
        } else if (meBody.user.companyId) {
          setValue("company_id", meBody.user.companyId);
          setValue("role", "collaborator");
        }
      })
      .catch((error: unknown) => setServerError(error instanceof Error ? error.message : "No se pudieron cargar los datos"))
      .finally(() => setLoading(false));
  }, [mode, setValue]);

  const submit = async (values: PersonInput) => {
    setServerError("");
    setNotice("");
    if (!editing && !values.password) {
      setServerError("La contraseña temporal es obligatoria.");
      return;
    }
    const payload = editing
      ? { full_name: values.full_name, email: values.email, password: values.password }
      : {
          ...values,
          company_id: mode === "manager" ? session?.companyId : values.company_id,
          role: mode === "manager" ? "collaborator" : values.role,
        };
    const response = await fetch(
      editing ? `/api/admin/users/${editing.id}` : "/api/admin/users",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "No se pudo guardar la cuenta");
      return;
    }
    if (editing) {
      setNotice("Cuenta actualizada correctamente.");
    } else if (body.emailDelivery?.sent) {
      setNotice("Cuenta creada y correo de acceso enviado correctamente.");
    } else {
      setNotice(`Cuenta creada, pero el correo no se pudo enviar: ${body.emailDelivery?.reason ?? "revisa la configuración de Resend"}`);
    }
    setEditing(null);
    reset({
      ...emptyValues,
      company_id: mode === "manager" ? session?.companyId ?? "" : "",
      role: mode === "manager" ? "collaborator" : "collaborator",
    });
    await load();
  };

  const edit = (person: Person) => {
    setEditing(person);
    setServerError("");
    setNotice("");
    reset({
      full_name: person.full_name,
      email: person.email,
      password: "",
      company_id: person.company_id,
      role: person.role,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditing(null);
    reset({
      ...emptyValues,
      company_id: mode === "manager" ? session?.companyId ?? "" : "",
      role: "collaborator",
    });
  };

  const deactivate = async (person: Person) => {
    if (!window.confirm(`¿Desactivar la cuenta de ${person.full_name}?`)) return;
    const response = await fetch(`/api/admin/users/${person.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No se pudo desactivar la cuenta");
    setNotice("Cuenta desactivada correctamente.");
    await load();
  };

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">EQUIPO</p>
      <h1 className="font-display text-3xl font-extrabold">{mode === "admin" ? "Personas" : "Colaboradores"}</h1>
      <p className="mt-2 text-slate-600">
        {mode === "admin"
          ? "Crea gestoras y colaboradoras, y asígnalas a una empresa."
          : "Crea y administra las colaboradoras de tu empresa."}
      </p>

      <div className="mt-7 grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={handleSubmit(submit)} className="card h-fit p-6" noValidate>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-3 font-display text-xl font-extrabold">
              <span className="rounded-xl bg-indigo-100 p-2 text-indigo-700">{editing ? <Pencil size={20} /> : <Plus size={20} />}</span>
              {editing ? "Editar cuenta" : "Nueva cuenta"}
            </h2>
            {editing && <button type="button" onClick={cancelEdit} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Cancelar edición"><X size={20} /></button>}
          </div>

          <div className="space-y-4">
            <Field label="Nombre completo" error={errors.full_name?.message}>
              <input {...register("full_name")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </Field>
            <Field label="Correo" error={errors.email?.message}>
              <input type="email" {...register("email")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </Field>
            <Field label={editing ? "Nueva contraseña" : "Contraseña temporal"} error={errors.password?.message}>
              <input type="password" {...register("password")} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder={editing ? "Déjala vacía para conservarla" : "Mínimo 8 caracteres"} />
            </Field>
            {!editing && mode === "admin" && (
              <>
                <Field label="Empresa" error={errors.company_id?.message}>
                  <select {...register("company_id")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                    <option value="">Selecciona una empresa</option>
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </Field>
                <Field label="Rol" error={errors.role?.message}>
                  <select {...register("role")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                    <option value="manager">Gestora</option>
                    <option value="collaborator">Colaboradora</option>
                  </select>
                </Field>
              </>
            )}
          </div>

          <button disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {isSubmitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear cuenta"}
          </button>
        </form>

        <div>
          {serverError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{serverError}</p>}
          {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
          <div className="card overflow-hidden">
            {loading ? <p className="p-8 text-center text-slate-500">Cargando personas...</p> : people.length === 0 ? (
              <div className="p-10 text-center"><UserRound className="mx-auto text-slate-300" size={38} /><p className="mt-4 font-bold">No hay cuentas todavía.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-5 py-4">Persona</th><th className="px-5 py-4">Empresa</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Alta</th><th className="px-5 py-4 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {people.map((person) => (
                      <tr key={person.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4"><p className="font-bold">{person.full_name}</p><p className="text-xs text-slate-500">{person.email}</p></td>
                        <td className="px-5 py-4">{companyName(person.company)}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{person.role === "manager" ? "Gestora" : "Colaboradora"}</span></td>
                        <td className="px-5 py-4 text-slate-600">{new Date(person.created_at).toLocaleDateString("es-EC")}</td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2">
                          <button onClick={() => edit(person)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100" aria-label={`Editar ${person.full_name}`}><Pencil size={17} /></button>
                          <button onClick={() => void deactivate(person)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50" aria-label={`Desactivar ${person.full_name}`}><Power size={17} /></button>
                        </div></td>
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

function companyName(company: Person["company"]) {
  if (Array.isArray(company)) return company[0]?.name ?? "Sin empresa";
  return company?.name ?? "Sin empresa";
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700"><span className="mb-2 block">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}
