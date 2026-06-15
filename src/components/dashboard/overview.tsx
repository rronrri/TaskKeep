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
        { label: "Empresas", value: data?.metrics.companies, icon: Building2, color: "text-indigo-700 bg-indigo-50" },
        { label: "Empresas activas", value: data?.metrics.activeCompanies, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
        { label: "Gestores/as", value: data?.metrics.managers, icon: UserRoundCog, color: "text-violet-700 bg-violet-50" },
        { label: "Colaboradores/as", value: data?.metrics.collaborators, icon: Users, color: "text-blue-700 bg-blue-50" },
      ]
    : [
        { label: "Pendientes", value: data?.metrics.pending, icon: CircleDashed, color: "text-amber-700 bg-amber-50" },
        { label: "En curso", value: data?.metrics.inProgress, icon: Clock3, color: "text-blue-700 bg-blue-50" },
        { label: "Completadas", value: data?.metrics.completed, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
        { label: "Vencidas", value: data?.metrics.overdue, icon: TriangleAlert, color: "text-red-700 bg-red-50" },
      ];

  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">RESUMEN</p>
      <h1 className="font-display text-3xl font-extrabold">Panel de {role === "admin" ? "administración" : "trabajo"}</h1>
      <p className="mt-2 text-slate-600">Consulta lo importante y actúa sobre lo que requiere atención.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="card p-5">
            <div className={`mb-5 inline-flex rounded-xl p-3 ${color}`}><Icon size={22} /></div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{value ?? "…"}</p>
          </article>
        ))}
      </div>

      {role === "admin" ? (
        <div className="card mt-7 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="font-display text-xl font-extrabold">Altas recientes</h2><p className="text-sm text-slate-500">Últimas personas incorporadas al sistema.</p></div><Link href="/admin/collaborators" className="font-bold text-indigo-700">Administrar</Link></div>
          <div className="divide-y divide-slate-200">
            {data?.recent?.length ? data.recent.map((person) => (
              <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div><p className="font-bold">{person.full_name}</p><p className="text-slate-500">{person.email}</p></div>
                <div className="text-right"><p className="font-semibold">{person.role === "manager" ? "Gestor/a" : "Colaborador/a"}</p><p className="text-xs text-slate-500">{companyName(person.company)}</p></div>
              </div>
            )) : <p className="p-6 text-sm text-slate-500">Todavía no hay personas registradas.</p>}
          </div>
        </div>
      ) : (
        <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="font-display text-xl font-extrabold">Próximas tareas</h2><p className="text-sm text-slate-500">Ordenadas por fecha límite.</p></div><Link href={`/${role}/tasks`} className="font-bold text-indigo-700">Ver todas</Link></div>
            <div className="divide-y divide-slate-200">
              {data?.upcoming?.length ? data.upcoming.map((task) => {
                const style = priorityStyles[task.priority];
                return <Link href={`/${role}/tasks?task=${task.id}`} key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                  <div><p className="font-bold">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.responsible?.full_name ?? "Responsable asignado"}</p></div>
                  <div className="text-right"><span className={`rounded-full px-2 py-1 text-xs font-bold ${style.badge}`}>{style.label}</span><p className="mt-2 text-xs text-slate-500">{task.deadline ? new Date(task.deadline).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha límite"}</p></div>
                </Link>;
              }) : <p className="p-6 text-sm text-slate-500">No hay tareas pendientes.</p>}
            </div>
          </div>
          <div className="space-y-4">
            <article className="card p-5"><div className="mb-3 inline-flex rounded-xl bg-orange-50 p-3 text-orange-700"><CalendarClock size={22} /></div><p className="text-sm font-semibold text-slate-500">Vencen en 7 días</p><p className="mt-1 text-3xl font-extrabold">{data?.metrics.dueSoon ?? "…"}</p></article>
            {role === "manager" && <Link href="/manager/status-requests" className="card block p-5 hover:border-indigo-300"><div className="mb-3 inline-flex rounded-xl bg-violet-50 p-3 text-violet-700"><ClipboardCheck size={22} /></div><p className="text-sm font-semibold text-slate-500">Aprobaciones pendientes</p><p className="mt-1 text-3xl font-extrabold">{data?.metrics.pendingRequests ?? "…"}</p></Link>}
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
