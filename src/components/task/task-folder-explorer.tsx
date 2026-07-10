"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Folder, FolderOpen, FolderPlus, HardDrive, Plus, Trash2 } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FolderContextMenu } from "./folder-context-menu";
import type { TaskFolder } from "@/types";

export type FolderSelection = "all" | "none" | string;

const TASK_MIME = "application/x-taskkeep-task";
const FOLDER_MIME = "application/x-taskkeep-folder";

export function TaskFolderExplorer({
  folders,
  selected,
  onSelect,
  onCreate,
  onDelete,
  onMoveTask,
  onMoveFolder,
  onNewTask,
  searchQuery = "",
  children: taskItems,
}: {
  folders: TaskFolder[];
  selected: FolderSelection;
  onSelect: (folder: FolderSelection) => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onDelete: (folder: TaskFolder) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, parentId: string | null) => Promise<void>;
  onNewTask: () => void;
  searchQuery?: string;
  children?: ReactNode;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskFolder | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ folder: TaskFolder; x: number; y: number } | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const childrenByParent = useMemo(() => groupChildren(folders), [folders]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const currentParentId = typeof selected === "string" && selected !== "all" && selected !== "none" ? selected : null;
  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentParentId, folderById), [currentParentId, folderById]);
  const selectedFolderName = currentParentId ? folderById.get(currentParentId)?.name ?? "Carpeta" : "Mi unidad";

  const selectFolder = (folderId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const folder of buildBreadcrumbs(folderId, folderById)) next.add(folder.id);
      return next;
    });
    onSelect(folderId);
  };

  const visibleTree = useMemo(() => {
    if (normalizedSearch) {
      return folders
        .filter((folder) => folder.name.toLowerCase().includes(normalizedSearch))
        .map((folder) => ({ folder, depth: 0, hasChildren: false }));
    }
    const result: Array<{ folder: TaskFolder; depth: number; hasChildren: boolean }> = [];
    const visit = (parentId: string | null, depth: number) => {
      for (const folder of childrenByParent.get(parentId) ?? []) {
        const hasChildren = (childrenByParent.get(folder.id) ?? []).length > 0;
        result.push({ folder, depth, hasChildren });
        if (hasChildren && expanded.has(folder.id)) visit(folder.id, depth + 1);
      }
    };
    visit(null, 0);
    return result;
  }, [childrenByParent, expanded, folders, normalizedSearch]);

  const toggleExpanded = (folderId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openCreate = () => {
    setParentId(currentParentId);
    setName("");
    setError("");
    setCreateOpen(true);
  };

  const createFolder = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(name.trim(), parentId);
      setCreateOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la carpeta");
    } finally {
      setBusy(false);
    }
  };

  const dropOn = async (event: React.DragEvent, targetFolderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    const taskId = event.dataTransfer.getData(TASK_MIME) || (event.dataTransfer.getData(FOLDER_MIME) ? "" : event.dataTransfer.getData("text/plain"));
    if (taskId) {
      await onMoveTask(taskId, targetFolderId);
      return;
    }
    const draggedId = event.dataTransfer.getData(FOLDER_MIME);
    if (!draggedId || draggedId === targetFolderId) return;
    const dragged = folderById.get(draggedId);
    if (!dragged || (dragged.parent_id ?? null) === targetFolderId) return;
    if (targetFolderId && collectDescendantIds(folders, draggedId).includes(targetFolderId)) return;
    await onMoveFolder(draggedId, targetFolderId);
  };

  const dragProps = (key: string, targetFolderId: string | null) => ({
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); setDropTarget(key); },
    onDragLeave: (event: React.DragEvent) => { event.stopPropagation(); setDropTarget((current) => (current === key ? null : current)); },
    onDrop: (event: React.DragEvent) => void dropOn(event, targetFolderId),
  });

  const openFolderMenu = (event: React.MouseEvent, folder: TaskFolder) => {
    event.preventDefault();
    event.stopPropagation();
    setFolderMenu({ folder, x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <section className="card overflow-visible md:grid md:grid-cols-[260px_1fr]">
        <aside className="border-b border-[var(--line)] bg-[var(--paper)] p-4 md:min-h-[30rem] md:border-b-0 md:border-r md:rounded-l-lg">
          <div className="grid gap-2">
            <button type="button" onClick={onNewTask} className="btn btn-primary !py-2.5 text-sm"><Plus size={17} /> Nueva tarea</button>
            <button type="button" onClick={openCreate} className="btn btn-ghost !py-2.5 text-sm"><FolderPlus size={17} /> Nueva carpeta</button>
          </div>

          <nav
            aria-label="Carpetas"
            {...dragProps("root", null)}
            className={`mt-5 min-h-[16rem] space-y-0.5 rounded-md pb-6 ${dropTarget === "root" ? "ring-2 ring-[var(--primary)]" : ""}`}
          >
            <p className="folio px-2 pb-1 uppercase">Carpetas</p>
            <div
              {...dragProps("root-item", null)}
              className={`flex items-center rounded-md ${dropTarget === "root-item" ? "ring-2 ring-[var(--primary)]" : ""} ${selected === "none" ? "border-l-[3px] border-[var(--primary)] bg-[var(--primary-wash)]" : "border-l-[3px] border-transparent hover:bg-[var(--paper-deep)]"}`}
            >
              <span className="w-[19px] shrink-0" />
              <button type="button" onClick={() => onSelect("none")} className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pl-0.5 pr-2 text-left text-sm font-bold ${selected === "none" ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>
                <HardDrive size={16} className="shrink-0 text-[var(--primary)]" />
                <span className="truncate">Mi unidad</span>
              </button>
            </div>
            {visibleTree.length === 0 ? (
              <p className="py-1 pl-9 pr-2 text-xs text-[var(--ink-soft)]">{normalizedSearch ? "No hay carpetas que coincidan." : "Todavía no hay carpetas."}</p>
            ) : visibleTree.map(({ folder, depth, hasChildren }) => {
              const active = selected === folder.id;
              const isExpanded = expanded.has(folder.id);
              return (
                <div
                  key={folder.id}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData(FOLDER_MIME, folder.id); event.dataTransfer.effectAllowed = "move"; }}
                  onContextMenu={(event) => openFolderMenu(event, folder)}
                  {...dragProps(folder.id, folder.id)}
                  className={`group flex cursor-grab items-center rounded-md active:cursor-grabbing ${dropTarget === folder.id ? "ring-2 ring-[var(--primary)]" : ""} ${active ? "border-l-[3px] border-[var(--primary)] bg-[var(--primary-wash)]" : "border-l-[3px] border-transparent hover:bg-[var(--paper-deep)]"}`}
                  style={{ paddingLeft: `${2 + (normalizedSearch ? depth : depth + 1) * 14}px` }}
                >
                  {hasChildren ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpanded(folder.id); }} className="shrink-0 rounded p-0.5 text-[var(--ink-soft)] hover:bg-[var(--line)]" aria-label={isExpanded ? `Contraer ${folder.name}` : `Expandir ${folder.name}`} aria-expanded={isExpanded}>
                      <ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                  ) : (
                    <span className="w-[19px] shrink-0" />
                  )}
                  <button type="button" onClick={() => selectFolder(folder.id)} className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pl-0.5 pr-2 text-left text-sm font-semibold ${active ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>
                    {active || isExpanded ? <FolderOpen size={16} className="shrink-0 text-[#9A7B24]" /> : <Folder size={16} className="shrink-0 text-[#9A7B24]" />}
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(folder)} className="mr-1 shrink-0 rounded p-1 text-[var(--stamp-red)] opacity-0 hover:bg-[var(--stamp-red-wash)] focus:opacity-100 group-hover:opacity-100" aria-label={`Eliminar carpeta ${folder.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--ink-soft)]">
            <span className={`inline-flex rounded-md ${dropTarget === "crumb-root" ? "ring-2 ring-[var(--primary)]" : ""}`} {...dragProps("crumb-root", null)}>
              <button type="button" onClick={() => onSelect("none")} className={`cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--paper-deep)] ${selected === "none" ? "bg-[var(--primary-wash)] text-[var(--primary)]" : ""}`}>Mi unidad</button>
            </span>
            {breadcrumbs.map((folder) => (
              <span key={folder.id} className="inline-flex items-center gap-2">
                <ChevronRight size={15} className="text-[var(--line-strong)]" />
                <span className={`inline-flex rounded-md ${dropTarget === `crumb-${folder.id}` ? "ring-2 ring-[var(--primary)]" : ""}`} {...dragProps(`crumb-${folder.id}`, folder.id)}>
                  <button type="button" onClick={() => selectFolder(folder.id)} className={`cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--paper-deep)] ${selected === folder.id ? "bg-[var(--primary-wash)] text-[var(--primary)]" : ""}`}>{folder.name}</button>
                </span>
              </span>
            ))}
          </div>

          <p className="mb-3 mt-4 flex items-center gap-2 font-display text-sm font-bold text-[var(--ink)]"><ClipboardList size={16} className="text-[var(--ink-soft)]" />{selectedFolderName}</p>
          {!taskItems ? (
            <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-deep)] px-5 py-8 text-center text-sm text-[var(--ink-soft)]">No hay tareas en esta ubicación.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{taskItems}</div>
          )}
        </div>
      </section>

      <AppDialog open={createOpen} onOpenChange={setCreateOpen} title="Nueva carpeta" description={parentId ? `Se creará dentro de "${folderById.get(parentId)?.name ?? "la carpeta actual"}".` : "Se creará en Mi unidad."} size="sm">
        <div className="space-y-4">
          <label className="block text-sm font-bold">Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} maxLength={80} placeholder="Ej. Proyecto clientes" className="input mt-2 !py-2.5" /></label>
          {error && <p className="rounded-md bg-[var(--stamp-red-wash)] p-3 text-sm font-semibold text-[var(--stamp-red)]">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="btn btn-ghost !py-2">Cancelar</button><button type="button" disabled={busy || !name.trim()} onClick={() => void createFolder()} className="btn btn-primary !py-2"><Plus size={17} />{busy ? "Creando..." : "Crear"}</button></div>
        </div>
      </AppDialog>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar carpeta"
        description={`Se eliminará la carpeta "${deleteTarget?.name ?? ""}" y también todo lo que tenga dentro. Esta acción se puede deshacer durante unos segundos desde la notificación.`}
        confirmLabel="Eliminar carpeta"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
      {folderMenu && <FolderContextMenu folder={folderMenu.folder} x={folderMenu.x} y={folderMenu.y} onClose={() => setFolderMenu(null)} onOpen={() => { onSelect(folderMenu.folder.id); setFolderMenu(null); }} onDelete={() => { setDeleteTarget(folderMenu.folder); setFolderMenu(null); }} />}
    </>
  );
}

function groupChildren(folders: TaskFolder[]) {
  const map = new Map<string | null, TaskFolder[]>();
  for (const folder of folders) map.set(folder.parent_id, [...(map.get(folder.parent_id) ?? []), folder]);
  return map;
}

function collectDescendantIds(folders: TaskFolder[], rootId: string) {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    const current = ids[index];
    for (const folder of folders) if (folder.parent_id === current) ids.push(folder.id);
  }
  return ids;
}

function buildBreadcrumbs(folderId: string | null, folderById: Map<string, TaskFolder>) {
  const path: TaskFolder[] = [];
  let current = folderId ? folderById.get(folderId) : undefined;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? folderById.get(current.parent_id) : undefined;
  }
  return path;
}
