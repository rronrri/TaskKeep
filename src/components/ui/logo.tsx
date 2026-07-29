/**
 * Marca de TaskKeep: escudo con tres verificaciones.
 *
 * Va en SVG en línea y no como imagen para que herede `currentColor`: así sirve
 * igual sobre fondo claro que sobre el panel oscuro del acceso, sin duplicar
 * ficheros ni recortar fondos.
 */
export function LogoMark({
  className = "",
  size = 32,
  animated = false,
}: {
  className?: string;
  size?: number;
  /** Dibuja el escudo y las verificaciones al aparecer. Sólo en la portada. */
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={`${animated ? "logo-draw" : ""} ${className}`.trim()}
      role="img"
      aria-label="TaskKeep"
    >
      <path
        d="M32 5.5 55.5 13.5V31.5C55.5 43.6 46 52.9 32 57.5 18 52.9 8.5 43.6 8.5 31.5V13.5L32 5.5Z"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <g stroke="currentColor" strokeWidth="3.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 25.5 24 30.5 42.5 16" pathLength={1} />
        <path d="M19 34 24 39 42.5 24.5" pathLength={1} />
        <path d="M19 42.5 24 47.5 42.5 33" pathLength={1} />
      </g>
    </svg>
  );
}

/** Marca más palabra, para cabeceras y la pantalla de acceso. */
export function Logo({
  className = "",
  size = 30,
  tagline = false,
}: {
  className?: string;
  size?: number;
  tagline?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} className="shrink-0" />
      <div className="min-w-0 leading-none">
        <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.72 }}>
          TaskKeep
        </span>
        {tagline && (
          <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] opacity-70">
            Prioriza lo que importa
          </span>
        )}
      </div>
    </div>
  );
}
