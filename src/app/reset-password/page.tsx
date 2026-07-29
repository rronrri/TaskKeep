import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
export default function Page() { return <main className="flex min-h-screen items-center justify-center p-6"><section className="card w-full max-w-md p-7"><p className="folio !text-[var(--primary)]">TASKKEEP</p><h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Nueva contraseña</h1><p className="mb-7 mt-2 text-[var(--ink-soft)]">Crea una contraseña segura para tu cuenta.</p><Suspense fallback={<p>Cargando…</p>}><ResetPasswordForm /></Suspense></section></main>; }
