import { CheckCircle2, CircleDashed, Clock3, TriangleAlert } from "lucide-react";
import type { UserRole } from "@/types";

const cards = [
  { label: "Pendientes", value: "—", icon: CircleDashed, color: "text-amber-700 bg-amber-50" },
  { label: "En curso", value: "—", icon: Clock3, color: "text-blue-700 bg-blue-50" },
  { label: "Completadas", value: "—", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
  { label: "Vencidas", value: "—", icon: TriangleAlert, color: "text-red-700 bg-red-50" },
];

export function Overview({ role }: { role: UserRole }) {
  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">RESUMEN</p>
      <h1 className="font-display text-3xl font-extrabold">Panel de {role === "admin" ? "administración" : "trabajo"}</h1>
      <p className="mt-2 text-slate-600">Consulta lo importante y actúa sobre las tareas que requieren atención.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="card p-5">
            <div className={`mb-5 inline-flex rounded-xl p-3 ${color}`}><Icon size={22} /></div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
          </article>
        ))}
      </div>
      <div className="card mt-7 p-6">
        <h2 className="font-display text-xl font-extrabold">Primeros pasos</h2>
        <p className="mt-2 text-slate-600">Configura Supabase y crea el usuario administrador inicial siguiendo el README. Las métricas se poblarán con los datos reales.</p>
      </div>
    </section>
  );
}
