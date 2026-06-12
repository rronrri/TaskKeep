"use client";

import { useState } from "react";
import { AppDialog } from "./app-dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  requiredText,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  requiredText?: string;
  danger?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = !requiredText || text === requiredText;
  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setText("");
        onOpenChange(nextOpen);
      }}
      title={title}
      description={description}
      size="sm"
    >
      {requiredText && (
        <label className="block text-sm font-semibold">
          Escribe <strong>{requiredText}</strong> para confirmar
          <input value={text} onChange={(event) => setText(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        </label>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={() => { setText(""); onOpenChange(false); }} className="rounded-xl border border-slate-300 px-4 py-2.5 font-bold">Cancelar</button>
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              setText("");
              onOpenChange(false);
            } finally {
              setBusy(false);
            }
          }}
          className={`rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {busy ? "Procesando..." : confirmLabel}
        </button>
      </div>
    </AppDialog>
  );
}
