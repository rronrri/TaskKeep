# TaskKeep — Rediseño visual "Expediente"

Fecha: 2026-07-09 · Estado: aprobado por Rodrigo

## Concepto

TaskKeep gestiona expedientes de trabajo: tareas con responsables, aprobaciones con historial,
carpetas de archivos, recordatorios. La UI adopta el lenguaje del archivo de oficina moderno:
papel, tinta, sellos de caucho, pestañas de carpeta y folios numerados. Solo tema claro.

Diferenciadores frente al look genérico "crema + serif + terracota":

- Primario tinta petróleo (`#16404D`), no terracota.
- Metadata en monoespaciada tipo folio.
- Sellos de estado con borde duro y mayúsculas, no pills suaves.
- Radios pequeños (6–10px), no `rounded-xl`/`rounded-2xl`.
- Pestaña de carpeta como dispositivo estructural real (las carpetas existen en el producto).

## Tokens de color (CSS custom properties en `globals.css`)

| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#F5F3EC` | fondo de la app |
| `--paper-deep` | `#EFEDE3` | sidebar, zonas hundidas |
| `--surface` | `#FDFCF8` | tarjetas, modales, inputs |
| `--ink` | `#1F2823` | texto principal |
| `--ink-soft` | `#5C645E` | texto secundario |
| `--primary` | `#16404D` | botones primarios, links, nav activa |
| `--primary-strong` | `#0E2E38` | hover de primario |
| `--primary-wash` | `#E7EEF0` | fondos suaves de primario (hover nav, iconos) |
| `--stamp-red` | `#A5311F` | crítico, destructivo, errores |
| `--stamp-red-wash` | `#F6E9E6` | fondos de error |
| `--line` | `#DED9CB` | bordes generales |
| `--line-strong` | `#B9B29E` | bordes de inputs y sellos |

Prioridades (tintas de sello; reemplaza verdes/celestes/naranjas/rojos Tailwind):

| Prioridad | Tinta | Wash |
|---|---|---|
| Baja | `#4A7058` | `#E9EFEA` |
| Media | `#9A7B24` | `#F3EDDC` |
| Alta | `#B4551D` | `#F6E9DF` |
| Crítica | `#A5311F` | `#F6E9E6` |

Semánticos de estado (éxito/info/aviso) derivan de las mismas tintas: éxito=salvia, aviso=ocre,
info=petróleo.

## Tipografía (next/font/google)

- Display: **Source Serif 4** (`--font-display`) — h1/h2, títulos de modales, cifras de métricas,
  marca. Pesos 600–700.
- Cuerpo: **Public Sans** (`--font-sans`) — reemplaza Inter. Peso 400–600.
- Mono: **IBM Plex Mono** (`--font-mono`) — folios, fechas, contadores, sellos. Números tabulares.

## Firma visual

**El sello + folio.**

- `.stamp`: mayúsculas, `letter-spacing: 0.08em`, borde 1.5px del color de tinta, fondo wash casi
  transparente, IBM Plex Mono, radio 4px, tamaño 11px. Variantes por prioridad y estado.
- `.folio`: línea de metadata en mono 11–12px, `--ink-soft`, separadores `·`
  (ej. `EXP · 12 JUL 2026 · M. TORRES`).
- Aprobaciones resueltas: sello grande con `transform: rotate(-2deg)` (aprobado=salvia,
  rechazado=rojo sello).

## Sistema de componentes (clases en `globals.css`)

- `.btn` base: radio 6px, padding coherente, `font-weight: 600`, press `scale(0.98)`.
  - `.btn-primary`: fondo `--primary`, texto blanco, hover `--primary-strong`.
  - `.btn-ghost`: superficie con borde `--line-strong`, hover `--paper-deep`.
  - `.btn-danger`: fondo `--stamp-red`, texto blanco.
- `.input`: fondo `--surface`, borde `--line-strong`, radio 6px, focus ring `--primary` 2px.
  Aplica a input/select/textarea.
- `.card`: fondo `--surface`, borde `--line`, radio 8px, sombra mínima. Variante
  `.card-priority-{low|medium|high|critical}` con borde superior 3px (lomo de expediente).
- Modales (`app-dialog.tsx`): overlay `rgb(20 28 26 / 0.6)`, contenido radio 10px, título serif,
  divisor bajo header.
- Carpetas (`task-folder-explorer.tsx`): pestaña de fólder con muesca (clip-path o pseudo-elemento)
  sobre la tarjeta de carpeta.
- Toasts (`toast-message.tsx`): borde izquierdo 3px semántico, timestamp en mono.
- Sidebar (`app-shell.tsx`): fondo `--paper-deep`, marca en serif, ítem activo con barra de tinta
  izquierda 3px + `--primary-wash`.
- Login (`login/page.tsx`): panel izquierdo `--primary` con textura sutil de líneas horizontales
  (repeating-linear-gradient de baja opacidad), titular serif grande.
- FullCalendar (`task-calendar.tsx` + CSS): variables `--fc-*` para heredar paleta; eventos con
  tintas de sello.

## Motion

- Micro-interacciones 150–250ms ease-out.
- Modales: fade + scale desde 0.97 al abrir.
- Sin animaciones decorativas adicionales.
- `@media (prefers-reduced-motion: reduce)`: desactivar transforms/animaciones.

## Alcance

1. `src/app/globals.css` — tokens + clases sistema + overrides FullCalendar.
2. `src/app/layout.tsx` — fuentes nuevas.
3. `src/lib/tasks/priority-style.ts` — nuevo mapa de estilos.
4. Migración de clases inline en los 27 componentes de `src/components` y páginas de `src/app`
   (login, forgot/reset password, dashboards, tareas, calendario, personas, empresas, auditoría,
   recordatorios, configuración, perfiles).
5. Accesibilidad: contraste ≥4.5:1 en todos los pares texto/fondo, focus visible conservado,
   touch targets conservados.

Fuera de alcance: dark mode, cambios funcionales, cambios de API o datos.

## Criterio de éxito

- Ninguna vista conserva indigo/slate como paleta.
- Sistema de clases centralizado: botones/inputs/cards nuevos no repiten utilidades inline largas.
- La app se reconoce en una captura: sellos, folios, papel, serif.
- `npm run build` pasa sin errores.
