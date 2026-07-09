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
          <input value={text} onChange={(event) => setText(event.target.value)} className="input mt-2" />
        </label>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={() => { setText(""); onOpenChange(false); }} className="btn btn-ghost">Cancelar</button>
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
          className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
        >
          {busy ? "Procesando..." : confirmLabel}
        </button>
      </div>
    </AppDialog>
  );
}
