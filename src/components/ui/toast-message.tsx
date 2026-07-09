"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

export function ToastMessages({
  success,
  error,
  successAction,
  onClearSuccess,
  onClearError,
}: {
  success?: string;
  error?: string;
  successAction?: { label: string; onClick: () => void | Promise<void> } | null;
  onClearSuccess: () => void;
  onClearError: () => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
      {error && <Toast message={error} type="error" onClose={onClearError} />}
      {success && <Toast message={success} type="success" action={successAction} onClose={onClearSuccess} />}
    </div>
  );
}

function Toast({ message, type, action, onClose }: { message: string; type: "success" | "error"; action?: { label: string; onClick: () => void | Promise<void> } | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const success = type === "success";
  return (
    <div role={success ? "status" : "alert"} className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border border-l-[3px] border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] shadow-xl ${success ? "border-l-[var(--prio-low)]" : "border-l-[var(--stamp-red)]"}`}>
      {success ? <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--prio-low)]" size={20} /> : <CircleAlert className="mt-0.5 shrink-0 text-[var(--stamp-red)]" size={20} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{message}</p>
        {action && (
          <button type="button" onClick={() => void action.onClick()} className="btn btn-ghost mt-2 !px-3 !py-1.5 text-xs">
            {action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} className="rounded-md p-1 opacity-60 hover:bg-[var(--paper-deep)] hover:opacity-100" aria-label="Cerrar notificacion"><X size={16} /></button>
      <span className={`absolute bottom-0 left-0 h-1 animate-[toast-life_5s_linear_forwards] rounded-b-lg ${success ? "bg-[var(--prio-low)]" : "bg-[var(--stamp-red)]"}`} />
    </div>
  );
}
