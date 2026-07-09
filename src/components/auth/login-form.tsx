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
      <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Correo electrónico</label><input id="email" type="email" autoComplete="email" {...register("email")} className="input" />{errors.email && <p className="mt-1 text-sm text-[var(--stamp-red)]">{errors.email.message}</p>}</div>
      <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="block text-sm font-semibold">Contraseña</label><Link href="/forgot-password" className="text-xs font-bold text-[var(--primary)]">¿La olvidaste?</Link></div><input id="password" type="password" autoComplete="current-password" {...register("password")} className="input" />{errors.password && <p className="mt-1 text-sm text-[var(--stamp-red)]">{errors.password.message}</p>}</div>
      {serverError && <p role="alert" className="rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm text-[var(--stamp-red)]">{serverError}</p>}
      <button disabled={isSubmitting} className="btn btn-primary w-full !py-3">{isSubmitting ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
