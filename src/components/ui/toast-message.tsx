"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

export function ToastMessages({
  success,
  error,
  onClearSuccess,
  onClearError,
}: {
  success?: string;
  error?: string;
  onClearSuccess: () => void;
  onClearError: () => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
      {error && <Toast message={error} type="error" onClose={onClearError} />}
      {success && <Toast message={success} type="success" onClose={onClearSuccess} />}
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
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
    <div role={success ? "status" : "alert"} className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur ${success ? "border-emerald-200 bg-emerald-50/95 text-emerald-950" : "border-red-200 bg-red-50/95 text-red-950"}`}>
      {success ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} /> : <CircleAlert className="mt-0.5 shrink-0 text-red-600" size={20} />}
      <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{message}</p>
      <button type="button" onClick={onClose} className="rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100" aria-label="Cerrar notificación"><X size={16} /></button>
      <span className={`absolute bottom-0 left-0 h-1 animate-[toast-life_5s_linear_forwards] rounded-b-2xl ${success ? "bg-emerald-500" : "bg-red-500"}`} />
    </div>
  );
}
