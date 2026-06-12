"use client";

import { useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json();
    setBusy(false);
    setMessage(response.ok ? body.message : body.error ?? "No se pudo procesar la solicitud");
  };
  return <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-semibold">Correo electrónico<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>{message && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">{message}</p>}<button disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Enviando…" : "Enviar enlace"}</button><Link href="/login" className="block text-center text-sm font-bold text-indigo-700">Volver al inicio de sesión</Link></form>;
}
