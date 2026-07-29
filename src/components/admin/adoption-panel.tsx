"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, FolderOpen, Users } from "lucide-react";

interface CompanyAdoption {
  company_id: string;
  company_name: string;
  manager_name: string | null;
  manager_email: string | null;
  manager_last_login: string | null;
  managers_total: number;
  collaborators_total: number;
  collaborators_active: number;
  tasks_created: number;
  tasks_completed: number;
  pending_approvals: number;
  drive_configured: boolean;
  last_activity: string | null;
}

const PERIODS = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

/** Días transcurridos desde una fecha, o null si nunca ocurrió. */
function daysSince(value: string | null) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

function relativeLabel(value: string | null) {
  const days = daysSince(value);
  if (days === null) return "Nunca";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} años`;
}

/**
 * Clasifica la salud de una empresa. El criterio es de uso real, no de tamaño:
 * una empresa con muchas cuentas pero sin actividad está peor que una pequeña
 * que trabaja todos los días.
 */
function health(row: CompanyAdoption) {
  const since = daysSince(row.manager_last_login);
  if (since === null) return { label: "Sin estrenar", tone: "stamp-neutral" as const, warn: true };
  if (since > 30) return { label: "Inactiva", tone: "stamp-danger" as const, warn: true };
  if (since > 14) return { label: "En riesgo", tone: "stamp-medium" as const, warn: true };
  if (row.collaborators_total > 0 && row.collaborators_active === 0) {
    return { label: "Equipo inactivo", tone: "stamp-medium" as const, warn: true };
  }
  return { label: "Activa", tone: "stamp-success" as const, warn: false };
}

export function AdoptionPanel() {
  const [rows, setRows] = useState<CompanyAdoption[]>([]);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  // El período ya reflejado en `rows`. Comparándolo con el elegido se deriva el
  // estado de carga, en lugar de mantenerlo como estado aparte.
  const [loadedDays, setLoadedDays] = useState<number | null>(null);
  const loading = loadedDays !== days && !error;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/adoption?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la adopción");
        if (cancelled) return;
        setRows(body.data as CompanyAdoption[]);
        setError("");
        setLoadedDays(days);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Error al cargar");
      });
    return () => { cancelled = true; };
  }, [days]);

  const needsAttention = rows.filter((row) => health(row).warn);
  const totalCollaborators = rows.reduce((sum, row) => sum + row.collaborators_total, 0);
  const activeCollaborators = rows.reduce((sum, row) => sum + row.collaborators_active, 0);

  return (
    <section>
      <p className="folio !text-[var(--primary)]">ADMINISTRACIÓN</p>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Adopción por empresa</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Quién está usando TaskKeep de verdad y si su equipo lo acompaña.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="folio uppercase">Período</span>
        {PERIODS.map((period) => (
          <button
            key={period.days}
            type="button"
            onClick={() => setDays(period.days)}
            className={`btn !px-4 !py-2 text-sm ${days === period.days ? "btn-primary" : "btn-ghost"}`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-[var(--stamp-red-wash)] p-4 text-sm font-semibold text-[var(--stamp-red)]">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Empresas" value={rows.length} />
        <Metric icon={AlertTriangle} label="Requieren atención" value={needsAttention.length} tone={needsAttention.length > 0 ? "warn" : undefined} />
        <Metric icon={Users} label="Colaboradores activos" value={`${activeCollaborators} / ${totalCollaborators}`} />
        <Metric icon={FolderOpen} label="Con Drive configurado" value={`${rows.filter((row) => row.drive_configured).length} / ${rows.length}`} />
      </div>

      {loading ? (
        <p className="mt-6 rounded-lg bg-[var(--paper)] p-6 text-sm text-[var(--ink-soft)]">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-lg bg-[var(--paper)] p-6 text-sm text-[var(--ink-soft)]">Todavía no hay empresas registradas.</p>
      ) : (
        <>
          {/* Tabla en pantallas anchas */}
          <div className="card mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--paper)] text-xs uppercase text-[var(--ink-soft)]">
                <tr>
                  <th className="px-5 py-4">Empresa</th>
                  <th className="px-5 py-4">Gestor/a</th>
                  <th className="px-5 py-4">Equipo</th>
                  <th className="px-5 py-4">Tareas</th>
                  <th className="px-5 py-4">Pendientes</th>
                  <th className="px-5 py-4">Drive</th>
                  <th className="px-5 py-4">Último acceso</th>
                  <th className="px-5 py-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((row) => {
                  const state = health(row);
                  return (
                    <tr key={row.company_id} className="hover:bg-[var(--paper)]">
                      <td className="px-5 py-4 font-bold">{row.company_name}</td>
                      <td className="px-5 py-4">
                        {row.manager_name ?? <span className="text-[var(--ink-soft)]">Sin gestor/a</span>}
                        {row.managers_total > 1 && <span className="folio ml-2">+{row.managers_total - 1}</span>}
                      </td>
                      <td className="px-5 py-4 tabular-nums">
                        {row.collaborators_active} / {row.collaborators_total}
                      </td>
                      <td className="px-5 py-4 tabular-nums">
                        {row.tasks_created} <span className="text-[var(--ink-soft)]">creadas</span> · {row.tasks_completed} <span className="text-[var(--ink-soft)]">hechas</span>
                      </td>
                      <td className="px-5 py-4 tabular-nums">{row.pending_approvals || "—"}</td>
                      <td className="px-5 py-4">
                        {row.drive_configured
                          ? <CheckCircle2 size={18} className="text-[var(--prio-low)]" aria-label="Configurado" />
                          : <span className="text-[var(--line-strong)]" aria-label="Sin configurar">—</span>}
                      </td>
                      <td className="px-5 py-4 folio">{relativeLabel(row.manager_last_login)}</td>
                      <td className="px-5 py-4"><span className={`stamp ${state.tone}`}>{state.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en pantallas estrechas: una tabla de 8 columnas no se lee en un teléfono */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:hidden">
            {rows.map((row) => {
              const state = health(row);
              return (
                <article key={row.company_id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-bold">{row.company_name}</p>
                      <p className="folio mt-1 truncate">{row.manager_name ?? "Sin gestor/a"}</p>
                    </div>
                    <span className={`stamp ${state.tone} shrink-0`}>{state.label}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Cell label="Equipo activo" value={`${row.collaborators_active} / ${row.collaborators_total}`} />
                    <Cell label="Último acceso" value={relativeLabel(row.manager_last_login)} />
                    <Cell label="Tareas creadas" value={String(row.tasks_created)} />
                    <Cell label="Completadas" value={String(row.tasks_completed)} />
                    <Cell label="Pendientes" value={String(row.pending_approvals)} />
                    <Cell label="Drive" value={row.drive_configured ? "Configurado" : "Sin configurar"} />
                  </dl>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string | number; tone?: "warn" }) {
  return (
    <div className={`card p-5 ${tone === "warn" ? "border-[#9A7B24]" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon size={18} className={tone === "warn" ? "text-[#9A7B24]" : "text-[var(--primary)]"} />
        <p className="folio uppercase">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-bold sm:text-3xl">{value}</p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="folio uppercase">{label}</dt>
      <dd className="mt-0.5 font-semibold text-[var(--ink)]">{value}</dd>
    </div>
  );
}
