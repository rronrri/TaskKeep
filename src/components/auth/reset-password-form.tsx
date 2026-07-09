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
  return <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-semibold">Nueva contraseña<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input mt-2" /></label><label className="block text-sm font-semibold">Confirmar contraseña<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="input mt-2" /></label>{message && <p role="status" className={`rounded-md p-3 text-sm ${success ? "bg-[#E9EFEA] text-[#4A7058]" : "bg-[var(--stamp-red-wash)] text-[var(--stamp-red)]"}`}>{message}</p>}{success ? <Link href="/login" className="btn btn-primary w-full !py-3">Ir a iniciar sesión</Link> : <button disabled={busy || !token} className="btn btn-primary w-full !py-3">{busy ? "Guardando…" : "Cambiar contraseña"}</button>}</form>;
}
