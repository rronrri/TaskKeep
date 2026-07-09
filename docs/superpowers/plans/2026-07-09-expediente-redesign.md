# Rediseño visual "Expediente" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el look genérico indigo/slate de TaskKeep por el sistema visual "Expediente" (papel, tinta petróleo, sellos, folios) en toda la app, sin cambios funcionales.

**Architecture:** Sistema de clases centralizado en `globals.css` (tokens CSS + clases `.btn*`, `.input`, `.card*`, `.stamp*`, `.folio`, `.folder-tab`) + migración mecánica de utilidades Tailwind inline en componentes y páginas mediante tabla de mapeo. Fuentes vía `next/font/google`.

**Tech Stack:** Next.js 16, Tailwind CSS 4 (`@import "tailwindcss"` + `@theme inline`), Radix Dialog, FullCalendar, lucide-react.

## Global Constraints

- Solo tema claro. Sin dark mode.
- Cero cambios funcionales: no tocar lógica, props, handlers, fetch, validaciones ni textos (salvo donde el spec pide folios/sellos como presentación de datos existentes).
- Contraste texto/fondo ≥ 4.5:1.
- Focus visible se conserva (`:focus-visible` global).
- No hay infraestructura de tests unitarios en el repo; la verificación por tarea es `npm run lint` + `npx tsc --noEmit`, y `npm run build` al final.
- Commits frecuentes, uno por tarea.

## Tabla de mapeo (usar en TODAS las tareas de migración)

Colores/utilidades viejas → nuevas. Aplicar en cada archivo tocado; si un caso no está en la tabla, elegir el token semánticamente equivalente.

| Viejo | Nuevo |
|---|---|
| `bg-indigo-600 ... text-white` (botón) | `btn btn-primary` |
| `bg-indigo-700`, `hover:bg-indigo-700` | (cubierto por `.btn-primary`) |
| `border border-slate-300 ... font-bold` (botón secundario) | `btn btn-ghost` |
| `bg-red-600 text-white` (botón peligro) | `btn btn-danger` |
| `rounded-xl border border-slate-300 px-4 py-3` (input) | `input` |
| `rounded-xl border border-slate-300 px-3 py-2.5` (input) | `input` |
| `text-indigo-600` / `text-indigo-700` (links, eyebrows) | `text-[var(--primary)]` |
| `bg-indigo-50` / `hover:bg-indigo-50` | `bg-[var(--primary-wash)]` / `hover:bg-[var(--primary-wash)]` |
| `bg-indigo-100` | `bg-[var(--primary-wash)]` |
| `text-slate-500` / `text-slate-600` | `text-[var(--ink-soft)]` |
| `text-slate-700` / `text-slate-900` | `text-[var(--ink)]` |
| `border-slate-200` / `divide-slate-200` | `border-[var(--line)]` / `divide-[var(--line)]` |
| `bg-slate-50` (hover filas, fondos suaves) | `bg-[var(--paper)]` / `hover:bg-[var(--paper)]` |
| `bg-slate-100` | `bg-[var(--paper-deep)]` |
| `bg-white` (superficies) | `bg-[var(--surface)]` |
| `rounded-2xl` / `rounded-xl` (contenedores) | `rounded-lg` (8px) |
| `rounded-xl` / `rounded-lg` (botones/inputs ya cubiertos por clases) | (eliminar; la clase sistema trae radio) |
| `text-red-700/800` + `bg-red-50` (errores) | `text-[var(--stamp-red)]` + `bg-[var(--stamp-red-wash)]` |
| `bg-emerald-*` éxito | tinta salvia: `text-[#4A7058]` / `bg-[#E9EFEA]` |
| `bg-amber-*` aviso | tinta ocre: `text-[#9A7B24]` / `bg-[#F3EDDC]` |
| badges pill `rounded-full px-2 py-1 text-xs font-bold` | `stamp` + variante |
| `font-extrabold` en h1/h2/títulos display | `font-bold` (serif ya pesa visualmente) |

Iconos de dashboard con `color: "text-X-700 bg-X-50"`: usar washes de tinta (`text-[var(--primary)] bg-[var(--primary-wash)]`, salvia, ocre, etc. según semántica).

---

### Task 1: Fundación — tokens, fuentes y clases sistema

**Files:**
- Modify: `src/app/globals.css` (reemplazo completo)
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: variables CSS (`--paper`, `--paper-deep`, `--surface`, `--ink`, `--ink-soft`, `--primary`, `--primary-strong`, `--primary-wash`, `--stamp-red`, `--stamp-red-wash`, `--line`, `--line-strong`, `--prio-low`, `--prio-low-wash`, `--prio-medium`, `--prio-medium-wash`, `--prio-high`, `--prio-high-wash`, `--prio-critical`, `--prio-critical-wash`); clases `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.input`, `.card`, `.card-priority-low|medium|high|critical`, `.stamp`, `.stamp-low|medium|high|critical|success|danger|neutral|primary`, `.folio`, `.folder-tab`, `.stamp-seal`; fuentes `--font-sans` (Public Sans), `--font-display` (Source Serif 4), `--font-mono` (IBM Plex Mono).

- [ ] **Step 1: Reemplazar `src/app/globals.css` completo con:**

```css
@import "tailwindcss";

:root {
  --paper: #f5f3ec;
  --paper-deep: #efede3;
  --surface: #fdfcf8;
  --ink: #1f2823;
  --ink-soft: #5c645e;
  --primary: #16404d;
  --primary-strong: #0e2e38;
  --primary-wash: #e7eef0;
  --stamp-red: #a5311f;
  --stamp-red-wash: #f6e9e6;
  --line: #ded9cb;
  --line-strong: #b9b29e;
  --prio-low: #4a7058;
  --prio-low-wash: #e9efea;
  --prio-medium: #9a7b24;
  --prio-medium-wash: #f3eddc;
  --prio-high: #b4551d;
  --prio-high-wash: #f6e9df;
  --prio-critical: #a5311f;
  --prio-critical-wash: #f6e9e6;
  --background: var(--paper);
  --foreground: var(--ink);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-public-sans);
  --font-display: var(--font-source-serif);
  --font-mono: var(--font-plex-mono);
}

* { box-sizing: border-box; }
body {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-public-sans), sans-serif;
}
button, input, select, textarea { font: inherit; }
button:not(:disabled), a[href], select, label[for], input[type="checkbox"], input[type="radio"] { cursor: pointer; }
button, a[href], select { transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
button:disabled { cursor: not-allowed; }
:focus-visible { outline: 3px solid #6c98a5; outline-offset: 2px; }
@keyframes toast-life { from { width: 100%; } to { width: 0%; } }
@keyframes dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

/* ── Botones ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 6px;
  padding: 0.625rem 1rem;
  font-weight: 600;
  border: 1px solid transparent;
}
.btn:not(:disabled):active { transform: scale(0.98); }
.btn:disabled { opacity: 0.55; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:not(:disabled):hover { background: var(--primary-strong); }
.btn-ghost { background: var(--surface); border-color: var(--line-strong); color: var(--ink); }
.btn-ghost:not(:disabled):hover { background: var(--paper-deep); }
.btn-danger { background: var(--stamp-red); color: #fff; }
.btn-danger:not(:disabled):hover { background: #872718; }

/* ── Inputs ── */
.input {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  padding: 0.7rem 1rem;
  color: var(--ink);
}
.input:focus-visible { outline: 2px solid var(--primary); outline-offset: 0; border-color: var(--primary); }
.input::placeholder { color: var(--ink-soft); opacity: 0.7; }

/* ── Tarjetas ── */
.card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(31 40 35 / 5%);
}
.card-priority-low { border-top: 3px solid var(--prio-low); }
.card-priority-medium { border-top: 3px solid var(--prio-medium); }
.card-priority-high { border-top: 3px solid var(--prio-high); }
.card-priority-critical { border-top: 3px solid var(--prio-critical); }

/* ── Sellos (firma visual) ── */
.stamp {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1.5px solid currentColor;
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  font-family: var(--font-plex-mono), monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.4;
  white-space: nowrap;
}
.stamp-low { color: var(--prio-low); background: var(--prio-low-wash); }
.stamp-medium { color: var(--prio-medium); background: var(--prio-medium-wash); }
.stamp-high { color: var(--prio-high); background: var(--prio-high-wash); }
.stamp-critical { color: var(--prio-critical); background: var(--prio-critical-wash); }
.stamp-success { color: var(--prio-low); background: var(--prio-low-wash); }
.stamp-danger { color: var(--stamp-red); background: var(--stamp-red-wash); }
.stamp-neutral { color: var(--ink-soft); background: var(--paper-deep); }
.stamp-primary { color: var(--primary); background: var(--primary-wash); }

/* Sello grande para resoluciones (aprobado/rechazado) */
.stamp-seal {
  display: inline-block;
  transform: rotate(-2deg);
  border: 2px solid currentColor;
  border-radius: 6px;
  padding: 0.35rem 0.9rem;
  font-family: var(--font-plex-mono), monospace;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* ── Folio (metadata en mono) ── */
.folio {
  font-family: var(--font-plex-mono), monospace;
  font-size: 11.5px;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

/* ── Pestaña de carpeta ── */
.folder-tab {
  position: relative;
  margin-top: 12px;
}
.folder-tab::before {
  content: "";
  position: absolute;
  top: -12px;
  left: 12px;
  width: 42%;
  max-width: 9rem;
  height: 13px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-bottom: none;
  border-radius: 6px 10px 0 0;
}

/* ── FullCalendar ── */
.fc {
  --fc-border-color: var(--line);
  --fc-page-bg-color: var(--surface);
  --fc-neutral-bg-color: var(--paper-deep);
  --fc-today-bg-color: var(--primary-wash);
  --fc-button-bg-color: var(--primary);
  --fc-button-border-color: var(--primary);
  --fc-button-hover-bg-color: var(--primary-strong);
  --fc-button-hover-border-color: var(--primary-strong);
  --fc-button-active-bg-color: var(--primary-strong);
  --fc-button-active-border-color: var(--primary-strong);
  --fc-event-border-color: transparent;
  font-family: var(--font-public-sans), sans-serif;
}
.fc .fc-toolbar-title { font-family: var(--font-source-serif), serif; font-weight: 700; }
.fc .fc-button { border-radius: 6px; font-weight: 600; text-transform: none; }
.fc .fc-daygrid-day-number, .fc .fc-col-header-cell-cushion { color: var(--ink); font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .btn:not(:disabled):active { transform: none; }
  .stamp-seal { transform: none; }
}
```

- [ ] **Step 2: Reemplazar fuentes en `src/app/layout.tsx`:**

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", weight: ["400", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaskKeep Empresarial",
  description: "Gestión empresarial de tareas, responsables y recordatorios",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${publicSans.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: sistema de diseño Expediente — tokens, fuentes y clases base"
```

---

### Task 2: Mapa de estilos de prioridad

**Files:**
- Modify: `src/lib/tasks/priority-style.ts` (reemplazo completo)

**Interfaces:**
- Produces: `priorityStyles: Record<TaskPriority, { label: string; card: string; badge: string; calendar: string }>` — misma forma que hoy; `card` ahora es la clase de lomo, `badge` la clase de sello.
- Consumers existentes usan `style.card`, `style.badge`, `style.calendar`, `style.label` — no cambian.

- [ ] **Step 1: Reemplazar contenido:**

```ts
import type { TaskPriority } from "@/types";

export const priorityStyles: Record<
  TaskPriority,
  { label: string; card: string; badge: string; calendar: string }
> = {
  low: {
    label: "Baja",
    card: "card-priority-low",
    badge: "stamp stamp-low",
    calendar: "#4a7058",
  },
  medium: {
    label: "Media",
    card: "card-priority-medium",
    badge: "stamp stamp-medium",
    calendar: "#9a7b24",
  },
  high: {
    label: "Alta",
    card: "card-priority-high",
    badge: "stamp stamp-high",
    calendar: "#b4551d",
  },
  critical: {
    label: "Crítica",
    card: "card-priority-critical",
    badge: "stamp stamp-critical",
    calendar: "#a5311f",
  },
};
```

- [ ] **Step 2: Buscar consumidores de `style.card`/`style.badge` y ajustar**

Run: `grep -rn "priorityStyles" src --include="*.tsx"`
En cada uso: quitar utilidades viejas adyacentes que duplicaban pill/fondo (ej. `rounded-full px-2 py-1 text-xs font-bold ${style.badge}` → `${style.badge}`; contenedores con `${style.card}` deben además llevar `card`).

- [ ] **Step 3: Verificar**

Run: `npm run lint && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat: prioridades como tintas de sello"
```

---

### Task 3: Primitivas UI — diálogos, campos, toasts

**Files:**
- Modify: `src/components/ui/app-dialog.tsx`
- Modify: `src/components/ui/confirm-dialog.tsx`
- Modify: `src/components/ui/field.tsx`
- Modify: `src/components/ui/toast-message.tsx`

**Interfaces:**
- Consumes: clases de Task 1. Props públicas de los 4 componentes NO cambian.

- [ ] **Step 1: `app-dialog.tsx`** — cambios de clase (estructura JSX igual):
  - Overlay: `bg-slate-950/55 backdrop-blur-sm` → `bg-[rgb(20_28_26/0.6)] backdrop-blur-sm`
  - Content: `rounded-2xl bg-white p-6 shadow-2xl` → `rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl animate-[dialog-in_180ms_ease-out]`
  - Header wrapper: `mb-6 pr-10` → `mb-6 border-b border-[var(--line)] pb-4 pr-10`
  - Title: `font-display text-2xl font-extrabold` → `font-display text-2xl font-bold`
  - Description: `text-slate-600` → `text-[var(--ink-soft)]`
  - Close: `rounded-lg p-2 text-slate-500 hover:bg-slate-100` → `rounded-md p-2 text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]`

- [ ] **Step 2: `confirm-dialog.tsx`**:
  - Input confirmación: `mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5` → `input mt-2`
  - Botón Cancelar: `rounded-xl border border-slate-300 px-4 py-2.5 font-bold` → `btn btn-ghost`
  - Botón confirmar: reemplazar todo el className por `` `btn ${danger ? "btn-danger" : "btn-primary"}` `` (el `disabled:opacity` ya lo cubre `.btn:disabled`).

- [ ] **Step 3: `field.tsx`**: label `text-slate-700` → `text-[var(--ink)]`; error `text-red-700` → `text-[var(--stamp-red)]`.

- [ ] **Step 4: `toast-message.tsx`**:
  - Contenedor toast: `rounded-2xl border p-4 shadow-xl backdrop-blur` + condicional emerald/red → `rounded-lg border-l-[3px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl` con borde izquierdo condicional: success `border-l-[var(--prio-low)]`, error `border-l-[var(--stamp-red)]`; texto `text-[var(--ink)]`.
  - Iconos: success `text-[var(--prio-low)]`, error `text-[var(--stamp-red)]`.
  - Botón acción: `btn btn-ghost !px-3 !py-1.5 text-xs`.
  - Barra de vida: success `bg-[var(--prio-low)]`, error `bg-[var(--stamp-red)]`; `rounded-b-2xl` → `rounded-b-lg`.

- [ ] **Step 5: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/components/ui
git commit -m "feat: primitivas UI al sistema Expediente"
```

---

### Task 4: Shell, navegación y autenticación

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/account-menu.tsx`
- Modify: `src/components/layout/logout-button.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/forgot-password-form.tsx`
- Modify: `src/components/auth/reset-password-form.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/app/reset-password/page.tsx`

**Interfaces:**
- Consumes: clases de Task 1, tabla de mapeo global.

- [ ] **Step 1: `app-shell.tsx`**:
  - Sidebar `<aside>`: `border-slate-200 bg-white` → `border-[var(--line)] bg-[var(--paper-deep)]`
  - Marca: `font-display text-xl font-extrabold text-indigo-700` → `font-display text-2xl font-bold text-[var(--primary)]`
  - Links nav: `rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700` → `rounded-md border-l-[3px] border-transparent px-3 py-2.5 text-sm font-semibold text-[var(--ink-soft)] hover:border-[var(--primary)] hover:bg-[var(--primary-wash)] hover:text-[var(--primary)]`
  - Header: `border-slate-200 bg-white` → `border-[var(--line)] bg-[var(--surface)]`; "TaskKeep" `text-indigo-600` → `font-display text-[var(--primary)]`; subtítulo → `folio` (clase) en vez de `text-xs text-slate-500`
  - Aviso contraseña temporal: `rounded-2xl border-amber-300 bg-amber-50 text-amber-900` → `rounded-lg border-[#9A7B24] bg-[#F3EDDC] text-[#6b5619]`

- [ ] **Step 2: `account-menu.tsx` y `logout-button.tsx`**: aplicar tabla de mapeo (leer archivo, sustituir indigo/slate/rounded según tabla).

- [ ] **Step 3: `login/page.tsx`**:
  - Panel izquierdo: `bg-indigo-950` → `bg-[var(--primary)]` con textura folio: añadir style inline `style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 34px, rgb(255 255 255 / 0.05) 34px, rgb(255 255 255 / 0.05) 35px)" }}`
  - Marca panel: `text-xl font-extrabold` → `font-display text-2xl font-bold`
  - Eyebrow: `text-indigo-300` → `text-[#9dbfc9]`
  - H1: `font-extrabold` → `font-bold` (serif via font-display ya presente)
  - Lista: `text-indigo-100` → `text-[#d9e6ea]`; iconos check `text-emerald-400` → `text-[#8fc7a8]`
  - Footer panel: `text-indigo-300` → `folio text-[#9dbfc9]`
  - Lado derecho: eyebrow móvil `text-indigo-600` → `text-[var(--primary)]`; `text-slate-600` → `text-[var(--ink-soft)]`; título `font-extrabold` → `font-bold`

- [ ] **Step 4: formularios auth (3 archivos)**: inputs → `input`; botón submit → `btn btn-primary w-full`; links `text-indigo-700` → `text-[var(--primary)]`; errores → `text-[var(--stamp-red)]` y cajas `bg-[var(--stamp-red-wash)] text-[var(--stamp-red)]`; éxito → salvia. Páginas forgot/reset: mapeo general.

- [ ] **Step 5: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/components/layout src/components/auth src/app/login src/app/forgot-password src/app/reset-password
git commit -m "feat: shell, navegación y auth al sistema Expediente"
```

---

### Task 5: Dashboard

**Files:**
- Modify: `src/components/dashboard/overview.tsx`
- Modify: páginas `src/app/{admin,manager,collaborator}/dashboard/page.tsx` si contienen clases (revisar con grep)

**Interfaces:**
- Consumes: Task 1 y 2.

- [ ] **Step 1: `overview.tsx`**:
  - Eyebrow "RESUMEN": `text-sm font-bold text-indigo-600` → `folio text-[var(--primary)]`
  - H1: `font-extrabold` → `font-bold`
  - Iconos métricas `color`: admin → `text-[var(--primary)] bg-[var(--primary-wash)]`, `text-[#4A7058] bg-[#E9EFEA]`, `text-[#9A7B24] bg-[#F3EDDC]`, `text-[var(--primary)] bg-[var(--primary-wash)]`; no-admin → ocre (pendientes), petróleo (en curso), salvia (completadas), rojo sello (vencidas). Contenedor icono `rounded-xl` → `rounded-md`.
  - Cifras `font-display text-3xl font-extrabold` → `font-display text-3xl font-bold` (además añadir `font-display` donde falte, ej. tarjeta "Vencen en 7 días").
  - Badge prioridad en "Próximas tareas": `rounded-full px-2 py-1 text-xs font-bold ${style.badge}` → `${style.badge}`
  - Fechas de deadline: envolver en clase `folio`.
  - Resto: tabla de mapeo (slate → ink/line/paper, `hover:border-indigo-300` → `hover:border-[var(--primary)]`, links `text-indigo-700` → `text-[var(--primary)]`).

- [ ] **Step 2: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/components/dashboard src/app
git commit -m "feat: dashboard al sistema Expediente"
```

---

### Task 6: Módulo de tareas — tableros, editor, vista previa, carpetas, aprobaciones

**Files:**
- Modify: `src/components/task/task-board.tsx`
- Modify: `src/components/task/manager-task-board.tsx`
- Modify: `src/components/task/task-filters.tsx`
- Modify: `src/components/task/task-editor-dialog.tsx`
- Modify: `src/components/task/task-preview-dialog.tsx`
- Modify: `src/components/task/task-folder-explorer.tsx`
- Modify: `src/components/task/folder-context-menu.tsx`
- Modify: `src/components/task/task-context-menu.tsx`
- Modify: `src/components/task/task-timing-info.tsx`
- Modify: `src/components/task/status-requests.tsx`
- Modify: páginas `src/app/{manager,collaborator}/tasks/page.tsx` y `src/app/manager/status-requests/page.tsx` si contienen clases

**Interfaces:**
- Consumes: Tasks 1–3. Props/lógica intactas.

- [ ] **Step 1: Tableros (`task-board.tsx`, `manager-task-board.tsx`)**: tabla de mapeo + reglas específicas:
  - Tarjeta de tarea: contenedor recibe `card ${style.card}` (lomo superior de prioridad); eliminar fondos wash viejos de prioridad en tarjeta (`bg-emerald-50` etc. quedaron fuera con el nuevo `priorityStyles`).
  - Badges estado/prioridad → `stamp stamp-*` (estado: pendiente=`stamp-neutral`, en curso=`stamp-primary`, completada=`stamp-success`, vencida=`stamp-danger`; nombres exactos de estados: revisar en archivo).
  - Línea de metadata (responsable, fecha): clase `folio`, formato `12 JUL 2026 · M. TORRES` — usar los mismos datos ya renderizados, solo presentación; separador `·`.
  - Botones acción → `btn btn-primary` / `btn btn-ghost` / `btn btn-danger` según semántica.

- [ ] **Step 2: `task-filters.tsx`**: selects/inputs → `input`; chips activos → `stamp stamp-primary`; botones → `btn btn-ghost`.

- [ ] **Step 3: `task-editor-dialog.tsx` y `task-preview-dialog.tsx`**: tabla de mapeo; inputs → `input`; secciones de metadata en preview → `folio`; barra de tiempo existente: colores → tokens (`--prio-*` según urgencia si aplica); botones → `btn*`.

- [ ] **Step 4: `task-folder-explorer.tsx`** — firma carpeta:
  - Tarjeta de carpeta: añadir clases `card folder-tab` al contenedor (la pestaña la dibuja `::before` de Task 1). Ajustar contenedor padre si necesita `pt-3` para no cortar la pestaña (overflow visible requerido: quitar `overflow-hidden` si lo tiene).
  - Resto: tabla de mapeo.

- [ ] **Step 5: menús contextuales (`folder-context-menu.tsx`, `task-context-menu.tsx`)**: fondo `bg-[var(--surface)]`, borde `border-[var(--line)]`, radio `rounded-md`, ítems hover `hover:bg-[var(--paper-deep)]`, ítem destructivo `text-[var(--stamp-red)]`.

- [ ] **Step 6: `task-timing-info.tsx`**: números/fechas → `folio` + tokens semánticos (vencido=rojo sello, próximo=ocre, holgado=salvia).

- [ ] **Step 7: `status-requests.tsx`** — sello de resolución:
  - Solicitud aprobada: badge → `<span className="stamp-seal text-[var(--prio-low)]">Aprobado</span>`; rechazada: `<span className="stamp-seal text-[var(--stamp-red)]">Rechazado</span>`; pendiente: `stamp stamp-neutral`.
  - Botones aprobar/rechazar → `btn btn-primary` / `btn btn-danger`.
  - Resto: tabla de mapeo.

- [ ] **Step 8: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/components/task src/app
git commit -m "feat: módulo de tareas al sistema Expediente"
```

---

### Task 7: Calendario

**Files:**
- Modify: `src/components/calendar/task-calendar.tsx`
- Modify: páginas `src/app/{manager,collaborator}/calendar/page.tsx` si contienen clases

**Interfaces:**
- Consumes: Task 1 (bloque `.fc` ya define variables), Task 2 (`priorityStyles.*.calendar` ya devuelve tintas nuevas).

- [ ] **Step 1:** Aplicar tabla de mapeo a controles propios del componente (filtros, leyenda, botones). Leyenda de prioridades → `stamp stamp-*`. Verificar que no exista CSS inline/`<style>` con colores indigo; si existe, migrar a tokens.

- [ ] **Step 2: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/components/calendar src/app
git commit -m "feat: calendario al sistema Expediente"
```

---

### Task 8: Administración, personas, empresas, perfil y páginas restantes

**Files:**
- Modify: `src/components/admin/audit-log-viewer.tsx`
- Modify: `src/components/admin/notification-log-viewer.tsx`
- Modify: `src/components/admin/system-settings.tsx`
- Modify: `src/components/company/companies-manager.tsx`
- Modify: `src/components/user/people-manager.tsx`
- Modify: `src/components/user/profile-manager.tsx`
- Modify: páginas restantes en `src/app/admin/**/page.tsx`, `src/app/{manager,collaborator}/profile/page.tsx`, `src/app/manager/collaborators/page.tsx`, `src/app/page.tsx` si contienen clases

**Interfaces:**
- Consumes: Tasks 1–3.

- [ ] **Step 1:** Tabla de mapeo en los 6 componentes + reglas:
  - Badges de rol/estado (activo/inactivo, gestor/colaborador) → `stamp stamp-primary` / `stamp stamp-neutral` / `stamp stamp-success` / `stamp stamp-danger` según semántica.
  - Timestamps de logs (auditoría, notificaciones) → `folio`.
  - Tablas: headers `text-[var(--ink-soft)]`, divisores `divide-[var(--line)]`, hover filas `hover:bg-[var(--paper)]`.
  - Formularios → `input`, botones → `btn*`.

- [ ] **Step 2:** Barrido de páginas: `grep -rln "indigo\|slate" src/app --include="*.tsx"` y migrar cada resultado con la tabla.

- [ ] **Step 3: Verificar y commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src
git commit -m "feat: administración y vistas restantes al sistema Expediente"
```

---

### Task 9: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Barrido de restos**

Run: `grep -rn "indigo\|bg-slate\|text-slate\|border-slate\|rounded-2xl\|rounded-xl" src --include="*.tsx" | grep -v node_modules`
Expected: cero resultados (o solo falsos positivos justificados, ej. clases de terceros).

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificación visual**

Levantar dev server y revisar: login, dashboard por rol, tableros de tareas, editor/preview, carpetas (pestaña visible), aprobaciones (sello rotado), calendario, admin (empresas, personas, auditoría, recordatorios, configuración), toasts, modales de confirmación. Confirmar contraste y focus.

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "fix: ajustes finales del sistema Expediente"
```
