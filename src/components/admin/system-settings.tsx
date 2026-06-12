"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Globe2, HardDrive, Mail, ShieldCheck, Timer, XCircle } from "lucide-react";

interface Status { database: boolean; email: boolean; drive: boolean; cron: boolean; publicUrl: string | null; cookieSecure: boolean; }

export function SystemSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/system-status", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la configuración");
        setStatus(body.data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar la configuración"));
  }, []);
  const items = [
    { label: "Base de datos Supabase", ready: status?.database, icon: Database, detail: "Persistencia principal y políticas de datos." },
    { label: "Correo con Resend", ready: status?.email, icon: Mail, detail: "Bienvenidas, recuperación y recordatorios." },
    { label: "Archivos en Google Drive", ready: status?.drive, icon: HardDrive, detail: "Requiere cuenta de servicio, clave privada y carpeta raíz." },
    { label: "Programador de recordatorios", ready: status?.cron, icon: Timer, detail: "Protegido mediante CRON_SECRET y configurado para Vercel." },
    { label: "Cookie segura", ready: status?.cookieSecure, icon: ShieldCheck, detail: "Debe estar activa cuando APP_URL usa HTTPS." },
  ];
  return <section><p className="text-sm font-bold text-indigo-600">SISTEMA</p><h1 className="font-display text-3xl font-extrabold">Configuración</h1><p className="mt-2 text-slate-600">Estado de las integraciones necesarias para operar TaskKeep.</p>{error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}<div className="mt-7 grid gap-4 md:grid-cols-2">{items.map(({ label, ready, icon: Icon, detail }) => <article key={label} className="card p-5"><div className="flex items-start justify-between gap-4"><span className="rounded-xl bg-slate-100 p-3 text-slate-700"><Icon size={22} /></span>{ready ? <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Lista</span> : <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><XCircle size={14} /> Pendiente</span>}</div><h2 className="mt-4 font-bold">{label}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p></article>)}</div><article className="card mt-5 flex items-start gap-4 p-5"><Globe2 className="mt-0.5 text-indigo-600" /><div><h2 className="font-bold">URL pública</h2><p className="mt-1 break-all text-sm text-slate-500">{status?.publicUrl ?? "No configurada"}</p></div></article></section>;
}
