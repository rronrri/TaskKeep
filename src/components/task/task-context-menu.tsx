"use client";

import { Folder, Inbox } from "lucide-react";
import type { Task, TaskFolder } from "@/types";

export function TaskContextMenu({
  task,
  folders,
  x,
  y,
  onClose,
  onMove,
}: {
  task: Task;
  folders: TaskFolder[];
  x: number;
  y: number;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void> | void;
}) {
  const folderOptions = flattenFolders(folders);
  const isInFolder = Boolean(task.folder_id);
  const position = clampMenuPosition(x, y, 288, Math.min(520, (isInFolder ? 156 : 104) + folderOptions.length * 36));
  return (
    <>
      <button type="button" aria-label="Cerrar opciones" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-transparent" />
      <div style={{ left: position.x, top: position.y }} className="fixed z-40 flex max-h-[min(32rem,calc(100vh-1.5rem))] w-72 flex-col overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] text-sm shadow-2xl">
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-2">
          <p className="folio truncate uppercase">Opciones de tarea</p>
          <p className="truncate font-bold text-[var(--ink)]">{task.title}</p>
        </div>
        <div className="overflow-y-auto py-2">
          {isInFolder && (
            <>
              <button type="button" onClick={() => void onMove(null)} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left font-bold hover:bg-[var(--paper-deep)]">
                <Inbox size={16} /> Sacar de carpeta
              </button>
              <div className="my-1 border-t border-[var(--line)]" />
            </>
          )}
          <p className="folio px-4 py-2 uppercase">Mover a carpeta</p>
          {folderOptions.length === 0 ? (
            <p className="px-4 py-2 text-sm text-[var(--ink-soft)]">No hay carpetas creadas.</p>
          ) : folderOptions.map(({ folder, depth }) => (
            <button key={folder.id} type="button" disabled={folder.id === task.folder_id} onClick={() => void onMove(folder.id)} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left font-semibold hover:bg-[var(--paper-deep)] disabled:cursor-not-allowed disabled:opacity-45" style={{ paddingLeft: `${16 + depth * 16}px` }}>
              <Folder size={16} className="text-[#9A7B24]" /> <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </div>
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

function flattenFolders(folders: TaskFolder[]) {
  const children = new Map<string | null, TaskFolder[]>();
  for (const folder of folders) children.set(folder.parent_id, [...(children.get(folder.parent_id) ?? []), folder]);
  const result: Array<{ folder: TaskFolder; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      result.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}


