"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, CircleDashed, Clock3, TriangleAlert, Users, UserRoundCog, ClipboardCheck, CalendarClock } from "lucide-react";
import type { TaskPriority, TaskStatus, UserRole } from "@/types";
import { priorityStyles } from "@/lib/tasks/priority-style";

interface UpcomingTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  responsible?: { full_name: string } | null;
}

interface DashboardData {
  role: UserRole;
  metrics: Record<string, number>;
  upcoming?: UpcomingTask[];
  recent?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: "manager" | "collaborator";
    created_at: string;
    company?: { name: string } | { name: string }[] | null;
  }>;
}

export function Overview({ role }: { role: UserRole }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el resumen");
        setData(body);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el resumen"));
  }, []);

  const cards = role === "admin"
    ? [
        { label: "Empresas", value: data?.metrics.companies, icon: Building2, color: "text-[var(--primary)] bg-[var(--primary-wash)]" },
        { label: "Empresas activas", value: data?.metrics.activeCompanies, icon: CheckCircle2, color: "text-[#4A7058] bg-[#E9EFEA]" },
        { label: "Gestores/as", value: data?.metrics.managers, icon: UserRoundCog, color: "text-[#9A7B24] bg-[#F3EDDC]" },
        { label: "Colaboradores/as", value: data?.metrics.collaborators, icon: Users, color: "text-[var(--primary)] bg-[var(--primary-wash)]" },
      ]
    : [
        { label: "Pendientes", value: data?.metrics.pending, icon: CircleDashed, color: "text-[#9A7B24] bg-[#F3EDDC]" },
        { label: "En curso", value: data?.metrics.inProgress, icon: Clock3, color: "text-[var(--primary)] bg-[var(--primary-wash)]" },
        { label: "Completadas", value: data?.metrics.completed, icon: CheckCircle2, color: "text-[#4A7058] bg-[#E9EFEA]" },
        { label: "Vencidas", value: data?.metrics.overdue, icon: TriangleAlert, color: "text-[var(--stamp-red)] bg-[var(--stamp-red-wash)]" },
      ];

  return (
    <section>
      <p className="folio !text-[var(--primary)]">RESUMEN</p>
      <h1 className="font-display text-3xl font-bold">Panel de {role === "admin" ? "administración" : "trabajo"}</h1>
      <p className="mt-2 text-[var(--ink-soft)]">Consulta lo importante y actúa sobre lo que requiere atención.</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">{error}</p>}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="card p-5">
            <div className={`mb-5 inline-flex rounded-md p-3 ${color}`}><Icon size={22} /></div>
            <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value ?? "…"}</p>
          </article>
        ))}
      </div>

      {role === "admin" ? (
        <div className="card mt-7 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] p-5"><div><h2 className="font-display text-xl font-bold">Altas recientes</h2><p className="text-sm text-[var(--ink-soft)]">Últimas personas incorporadas al sistema.</p></div><Link href="/admin/collaborators" className="font-bold text-[var(--primary)]">Administrar</Link></div>
          <div className="divide-y divide-[var(--line)]">
            {data?.recent?.length ? data.recent.map((person) => (
              <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div><p className="font-bold">{person.full_name}</p><p className="text-[var(--ink-soft)]">{person.email}</p></div>
                <div className="text-right"><p className="font-semibold">{person.role === "manager" ? "Gestor/a" : "Colaborador/a"}</p><p className="folio">{companyName(person.company)}</p></div>
              </div>
            )) : <p className="p-6 text-sm text-[var(--ink-soft)]">Todavía no hay personas registradas.</p>}
          </div>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5"><div><h2 className="font-display text-xl font-bold">Próximas tareas</h2><p className="text-sm text-[var(--ink-soft)]">Ordenadas por fecha límite.</p></div><Link href={`/${role}/tasks`} className="font-bold text-[var(--primary)]">Ver todas</Link></div>
            <div className="divide-y divide-[var(--line)]">
              {data?.upcoming?.length ? data.upcoming.map((task) => {
                const style = priorityStyles[task.priority];
                return <Link href={`/${role}/tasks?task=${task.id}`} key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--paper)]">
                  <div><p className="font-bold">{task.title}</p><p className="folio mt-1">{task.responsible?.full_name ?? "Responsable asignado"}</p></div>
                  <div className="text-right"><span className={style.badge}>{style.label}</span><p className="folio mt-2">{task.deadline ? new Date(task.deadline).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha límite"}</p></div>
                </Link>;
              }) : <p className="p-6 text-sm text-[var(--ink-soft)]">No hay tareas pendientes.</p>}
            </div>
          </div>
          <div className="space-y-4">
            <article className="card p-5"><div className="mb-3 inline-flex rounded-md bg-[#F6E9DF] p-3 text-[#B4551D]"><CalendarClock size={22} /></div><p className="text-sm font-semibold text-[var(--ink-soft)]">Vencen en 7 días</p><p className="mt-1 font-display text-3xl font-bold">{data?.metrics.dueSoon ?? "…"}</p></article>
            {role === "manager" && <Link href="/manager/status-requests" className="card block p-5 hover:border-[var(--primary)]"><div className="mb-3 inline-flex rounded-md bg-[var(--primary-wash)] p-3 text-[var(--primary)]"><ClipboardCheck size={22} /></div><p className="text-sm font-semibold text-[var(--ink-soft)]">Aprobaciones pendientes</p><p className="mt-1 font-display text-3xl font-bold">{data?.metrics.pendingRequests ?? "…"}</p></Link>}
          </div>
        </div>
      )}
    </section>
  );
}

function companyName(company: { name: string } | { name: string }[] | null | undefined) {
  if (Array.isArray(company)) return company[0]?.name ?? "Sin empresa";
  return company?.name ?? "Sin empresa";
}
