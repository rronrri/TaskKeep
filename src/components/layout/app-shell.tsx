import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BellRing, Building2, CalendarDays, ClipboardCheck, ClipboardList, LayoutDashboard, Settings, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import type { UserRole } from "@/types";
import { AccountMenu } from "./account-menu";


export async function AppShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(`/${user.role}/dashboard`);
  const regularLinks = [
    { href: `/${role}/dashboard`, label: "Resumen", icon: LayoutDashboard },
    ...(role !== "admin" ? [{ href: `/${role}/tasks`, label: "Tareas", icon: ClipboardList }] : []),
    ...(role !== "admin" ? [{ href: `/${role}/calendar`, label: "Calendario", icon: CalendarDays }] : []),
    ...(role === "manager" ? [{ href: "/manager/status-requests", label: "Aprobaciones", icon: ClipboardCheck }] : []),
    ...(role === "admin" ? [{ href: "/admin/companies", label: "Empresas", icon: Building2 }] : []),
    ...(role !== "collaborator" ? [{ href: `/${role}/collaborators`, label: "Personas", icon: Users }] : []),
    ...(role === "admin" ? [{ href: "/admin/logs", label: "Auditoría", icon: Activity }] : []),
    ...(role === "admin" ? [{ href: "/admin/notifications", label: "Recordatorios", icon: BellRing }] : []),
    ...(role === "admin" ? [{ href: "/admin/settings", label: "Configuración", icon: Settings }] : []),
  ];
  const links = user.mustChangePassword ? [] : regularLinks;
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r">
        <div className="mb-8 font-display text-xl font-extrabold text-indigo-700">TaskKeep</div>
        <nav aria-label="Navegación principal" className="flex gap-2 overflow-auto md:flex-col">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">
              <Icon size={19} />{label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-8">
          <div><p className="text-sm font-bold text-indigo-600">TaskKeep</p><p className="text-xs text-slate-500">Gestión de tareas</p></div>
          <AccountMenu fullName={user.fullName} role={user.role} />
        </header>
        <main className="p-5 md:p-8">
          {user.mustChangePassword && (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Tu cuenta está bloqueada hasta que reemplaces la contraseña temporal.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}



