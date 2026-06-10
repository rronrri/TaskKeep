import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, ClipboardCheck, ClipboardList, LayoutDashboard, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import type { UserRole } from "@/types";
import { LogoutButton } from "./logout-button";

const labels: Record<UserRole, string> = { admin: "Administrador", manager: "Gestor", collaborator: "Colaborador" };

export async function AppShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(`/${user.role}/dashboard`);
  const links = [
    { href: `/${role}/dashboard`, label: "Resumen", icon: LayoutDashboard },
    ...(role !== "admin" ? [{ href: `/${role}/tasks`, label: "Tareas", icon: ClipboardList }] : []),
    ...(role !== "admin" ? [{ href: `/${role}/calendar`, label: "Calendario", icon: CalendarDays }] : []),
    ...(role === "manager" ? [{ href: "/manager/status-requests", label: "Solicitudes", icon: ClipboardCheck }] : []),
    ...(role === "admin" ? [{ href: "/admin/companies", label: "Empresas", icon: Building2 }] : []),
    ...(role !== "collaborator" ? [{ href: `/${role}/collaborators`, label: "Personas", icon: Users }] : []),
  ];
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
          <div><p className="font-bold">{user.fullName}</p><p className="text-xs text-slate-500">{labels[user.role]}</p></div>
          <LogoutButton />
        </header>
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
