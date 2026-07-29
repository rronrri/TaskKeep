"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold">Correo electrónico</label>
        <input id="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" {...register("email")} className="input" />
        {errors.email && <p className="mt-1.5 text-sm text-[var(--stamp-red)]">{errors.email.message}</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="password" className="block text-sm font-semibold">Contraseña</label>
          <Link href="/forgot-password" className="text-xs font-bold text-[var(--primary)] hover:underline">¿La olvidaste?</Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            {...register("password")}
            className="input !pr-12"
          />
          {/* Escribir una contraseña a ciegas en el móvil es la primera causa de
              intentos fallidos, y ahora los intentos fallidos bloquean la cuenta. */}
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[var(--ink-soft)] hover:text-[var(--primary)]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="mt-1.5 text-sm text-[var(--stamp-red)]">{errors.password.message}</p>}
      </div>

      {serverError && (
        <p role="alert" className="rounded-md border border-[var(--stamp-red)] bg-[var(--stamp-red-wash)] p-3 text-sm font-semibold text-[var(--stamp-red)]">
          {serverError}
        </p>
      )}

      <button disabled={isSubmitting} className="btn btn-primary w-full !py-3">
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
