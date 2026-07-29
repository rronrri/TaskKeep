"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

const HIGHLIGHTS = [
  "Tareas y responsables en un solo lugar",
  "Aprobaciones con historial completo",
  "Recordatorios automáticos por correo",
];

/**
 * Escenario de la pantalla de acceso.
 *
 * Es una sola composición a sangre y no dos paneles contiguos: el degradado cubre
 * toda la ventana y el formulario flota encima, de modo que no hay costura entre
 * la parte de marca y la de entrada.
 *
 * El degradado sigue al cursor con un desfase mínimo. Es un gesto sutil: da
 * sensación de profundidad sin distraer de lo único que hay que hacer aquí.
 */
export function LoginStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.4 });

  useEffect(() => {
    // Ni en pantallas táctiles ni si se pidió reducir el movimiento.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPointer({
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight,
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Desplazamiento contenido: las manchas se mueven como mucho un 8 % del ancho.
  const shift = (axis: "x" | "y", strength: number) => (pointer[axis] - 0.5) * strength;

  return (
    <div ref={stageRef} className="relative min-h-screen overflow-hidden bg-[#1b2151]">
      <div
        className="pointer-events-none absolute inset-[-15%] transition-transform duration-[900ms] ease-out"
        style={{
          transform: `translate3d(${shift("x", 40)}px, ${shift("y", 30)}px, 0)`,
          backgroundImage: [
            "radial-gradient(58% 55% at 14% 12%, #5561d6 0%, transparent 62%)",
            "radial-gradient(48% 48% at 82% 8%, #7a63dd 0%, transparent 64%)",
            "radial-gradient(60% 55% at 68% 92%, #2b3486 0%, transparent 68%)",
            "radial-gradient(52% 48% at 22% 86%, #343e9e 0%, transparent 66%)",
          ].join(","),
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-[-20%] opacity-70 transition-transform duration-[1400ms] ease-out"
        style={{
          transform: `translate3d(${shift("x", -55)}px, ${shift("y", -35)}px, 0)`,
          backgroundImage:
            "radial-gradient(40% 40% at 45% 40%, #6f7ae8 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col justify-center gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid lg:grid-cols-[1.1fr_minmax(420px,0.9fr)] lg:items-center lg:gap-16 lg:px-16 lg:py-14">
        <section className="text-white">
          <LogoMark size={46} className="text-white/90 sm:hidden" animated />
          <LogoMark size={58} className="hidden text-white/90 sm:block" animated />

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.32em] text-white/55 lg:mt-9">
            Prioriza lo que importa
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-[1.9rem] font-bold leading-[1.12] sm:text-4xl lg:mt-5 lg:text-5xl xl:text-6xl">
            Todo el trabajo de tu empresa, claro y a tiempo.
          </h1>
          <ul className="mt-8 hidden space-y-4 text-[0.95rem] text-white/75 sm:text-base lg:block">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-white/45" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Vidrio esmerilado: el formulario se apoya sobre el mismo fondo en lugar
            de recortar un bloque blanco aparte. */}
        <section className="w-full rounded-2xl border border-white/15 bg-white/[0.97] p-6 shadow-[0_30px_80px_-30px_rgb(9_12_40/0.75)] backdrop-blur-xl sm:p-9 lg:justify-self-end">
          <h2 className="font-display text-2xl font-bold text-[var(--ink)] sm:text-3xl">Bienvenido</h2>
          <p className="mb-7 mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            Ingresa con tu cuenta empresarial para continuar.
          </p>
          {children}
        </section>
      </div>
    </div>
  );
}
