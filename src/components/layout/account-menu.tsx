"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { UserRole } from "@/types";

const labels: Record<UserRole, string> = { admin: "Administrador/a", manager: "Gestor/a", collaborator: "Colaborador/a" };

export function AccountMenu({ fullName, role }: { fullName: string; role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initials = useMemo(() => fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U", [fullName]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex cursor-pointer items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-left shadow-sm hover:border-[var(--primary)] hover:bg-[var(--primary-wash)]" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-10 place-items-center rounded-full bg-[var(--primary)] font-display text-sm font-bold text-white">{initials}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-48 truncate text-sm font-bold text-[var(--ink)]">{fullName}</span>
          <span className="block text-xs font-semibold text-[var(--ink-soft)]">{labels[role]}</span>
        </span>
      </button>

      {open && (
        <>
          <button type="button" aria-label="Cerrar menú de cuenta" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default bg-transparent" />
          <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm shadow-2xl" role="menu">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="truncate font-bold text-[var(--ink)]">{fullName}</p>
              <p className="text-xs font-semibold text-[var(--ink-soft)]">{labels[role]}</p>
            </div>
            <Link href={`/${role}/profile`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-3 font-bold text-[var(--ink)] hover:bg-[var(--paper-deep)]" role="menuitem">
              <UserCircle size={18} /> Ir al perfil
            </Link>
            <button type="button" onClick={() => void logout()} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left font-bold text-[var(--stamp-red)] hover:bg-[var(--stamp-red-wash)]" role="menuitem">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
