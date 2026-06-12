"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) return setMessage("Las contraseñas no coinciden.");
    setBusy(true);
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await response.json();
    setBusy(false);
    setSuccess(response.ok);
    setMessage(response.ok ? "Contraseña actualizada. Ya puedes iniciar sesión." : body.error ?? "No se pudo cambiar la contraseña");
  };
  return <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-semibold">Nueva contraseña<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="block text-sm font-semibold">Confirmar contraseña<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>{message && <p role="status" className={`rounded-xl p-3 text-sm ${success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message}</p>}{success ? <Link href="/login" className="block rounded-xl bg-indigo-600 px-4 py-3 text-center font-bold text-white">Ir a iniciar sesión</Link> : <button disabled={busy || !token} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Guardando…" : "Cambiar contraseña"}</button>}</form>;
}
