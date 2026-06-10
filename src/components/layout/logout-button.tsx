"use client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }}>Cerrar sesión</button>;
}
