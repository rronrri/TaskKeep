"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, XCircle } from "lucide-react";

interface Notification {
  id: string;
  notification_type: string;
  email: string;
  status: "sent" | "failed";
  error_message?: string | null;
  sent_at: string;
  task?: { title: string } | null;
  user?: { full_name: string } | null;
}

const labels: Record<string, string> = { deadline_7_days: "7 días antes (histórico)", deadline_5_days: "5 días antes", deadline_3_days: "3 días antes", deadline_1_day: "1 día antes", daily: "Diario", monthly: "Mensual" };

export function NotificationLogViewer() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los recordatorios");
        setItems(body.data ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los recordatorios"));
  }, []);
  return <section><p className="text-sm font-bold text-indigo-600">NOTIFICACIONES</p><h1 className="font-display text-3xl font-extrabold">Recordatorios enviados</h1><p className="mt-2 text-slate-600">Revisa entregas y errores de los avisos de fecha límite.</p>{error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}<div className="card mt-7 overflow-hidden">{items.length === 0 ? <div className="p-10 text-center"><BellRing className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-bold">Todavía no hay intentos de envío.</p></div> : <div className="divide-y divide-slate-200">{items.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex min-w-0 items-start gap-3">{item.status === "sent" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} /> : <XCircle className="mt-0.5 shrink-0 text-red-600" size={20} />}<div><p className="font-bold">{item.task?.title ?? "Tarea"} · {labels[item.notification_type] ?? item.notification_type}</p><p className="text-sm text-slate-500">{item.user?.full_name ?? item.email} · {item.email}</p>{item.error_message && <p className="mt-1 text-xs text-red-700">{item.error_message}</p>}</div></div><time className="text-sm text-slate-500">{new Date(item.sent_at).toLocaleString("es-EC")}</time></article>)}</div>}</div></section>;
}
