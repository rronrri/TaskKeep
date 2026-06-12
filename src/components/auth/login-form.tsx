"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const submit = async (values: LoginInput) => {
    setServerError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const body = await response.json();
    if (!response.ok) return setServerError(body.error ?? "No fue posible iniciar sesión");
    router.push(body.mustChangePassword ? `/${body.role}/profile?temporary=1` : `/${body.role}/dashboard`);
    router.refresh();
  };
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Correo electrónico</label><input id="email" type="email" autoComplete="email" {...register("email")} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />{errors.email && <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>}</div>
      <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="block text-sm font-semibold">Contraseña</label><Link href="/forgot-password" className="text-xs font-bold text-indigo-700">¿La olvidaste?</Link></div><input id="password" type="password" autoComplete="current-password" {...register("password")} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />{errors.password && <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>}</div>
      {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{serverError}</p>}
      <button disabled={isSubmitting} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{isSubmitting ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
