"use client";

import { FolderOpen, Trash2 } from "lucide-react";
import type { TaskFolder } from "@/types";

export function FolderContextMenu({ folder, x, y, onClose, onOpen, onDelete }: { folder: TaskFolder; x: number; y: number; onClose: () => void; onOpen: () => void; onDelete: () => void }) {
  const position = clampMenuPosition(x, y, 224, 132);
  return (
    <>
      <button type="button" aria-label="Cerrar opciones" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-transparent" />
      <div style={{ left: position.x, top: position.y }} className="fixed z-40 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 text-sm shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-2">
          <p className="truncate text-xs font-extrabold uppercase text-slate-500">Opciones de carpeta</p>
          <p className="truncate font-bold text-slate-900">{folder.name}</p>
        </div>
        <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left font-bold hover:bg-slate-50"><FolderOpen size={16} className="text-amber-700" /> Abrir carpeta</button>
        <button type="button" onClick={onDelete} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left font-bold text-red-700 hover:bg-red-50"><Trash2 size={16} /> Eliminar carpeta</button>
      </div>
    </>
  );
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  if (typeof window === "undefined") return { x, y };
  const padding = 12;
  return {
    x: Math.min(Math.max(padding, x), window.innerWidth - width - padding),
    y: Math.min(Math.max(padding, y), window.innerHeight - height - padding),
  };
}
