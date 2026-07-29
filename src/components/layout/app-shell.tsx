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
      {/* En móvil la barra lateral se convierte en una tira de navegación
          horizontal sobre el contenido, y el logotipo se oculta porque la
          cabecera ya lo muestra: repetirlo consumía una franja de alto útil. */}
      <aside className="border-b border-[var(--line)] bg-[var(--paper-deep)] px-3 py-2 md:min-h-screen md:border-b-0 md:border-r md:p-5">
        <div className="mb-8 hidden font-display text-2xl font-bold text-[var(--primary)] md:block">TaskKeep</div>
        <nav aria-label="Navegación principal" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:gap-2 md:overflow-visible md:px-0">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 flex-col items-center gap-1 rounded-md border-transparent px-3 py-2 text-[11px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--primary-wash)] hover:text-[var(--primary)] md:flex-row md:gap-3 md:border-l-[3px] md:py-2.5 md:text-sm md:hover:border-[var(--primary)]">
              <Icon size={19} />{label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 md:static md:px-8 md:py-4">
          <div className="min-w-0"><p className="font-display text-sm font-bold text-[var(--primary)]">TaskKeep</p><p className="folio truncate">Gestión de tareas</p></div>
          <AccountMenu fullName={user.fullName} role={user.role} />
        </header>
        <main className="p-4 sm:p-5 md:p-8">
          {user.mustChangePassword && (
            <div className="mb-6 rounded-lg border border-[#9A7B24] bg-[#F3EDDC] p-4 text-sm font-semibold text-[#6b5619]">
              Tu cuenta está bloqueada hasta que reemplaces la contraseña temporal.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}



