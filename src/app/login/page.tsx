import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/server/policies/permissions";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect(roleHome(user.role));
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-indigo-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="text-xl font-extrabold">TaskKeep</div>
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-bold uppercase tracking-[.25em] text-indigo-300">Gestión sin ruido</p>
          <h1 className="font-display text-5xl font-extrabold leading-tight">Todo el trabajo de tu empresa, claro y a tiempo.</h1>
          <ul className="mt-10 space-y-4 text-indigo-100">
            {["Tareas y responsables en un solo lugar", "Aprobaciones con historial completo", "Recordatorios automáticos por correo"].map((item) => (
              <li key={item} className="flex gap-3"><CheckCircle2 className="shrink-0 text-emerald-400" />{item}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-indigo-300">TaskKeep Empresarial</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <p className="mb-2 text-sm font-bold text-indigo-600 lg:hidden">TASKKEEP</p>
          <h2 className="font-display text-3xl font-extrabold">Bienvenido</h2>
          <p className="mb-8 mt-2 text-slate-600">Ingresa con tu cuenta empresarial.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
