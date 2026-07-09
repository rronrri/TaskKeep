"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Inbox, Layers3, Plus, Trash2 } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FolderContextMenu } from "./folder-context-menu";
import type { TaskFolder } from "@/types";

export type FolderSelection = "all" | "none" | string;

export function TaskFolderExplorer({
  folders,
  selected,
  onSelect,
  onCreate,
  onDelete,
  onMoveTask,
  onNewTask,
  taskCount = 0,
  searchQuery = "",
  children: taskItems,
}: {
  folders: TaskFolder[];
  selected: FolderSelection;
  onSelect: (folder: FolderSelection) => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onDelete: (folder: TaskFolder) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
  onNewTask: () => void;
  taskCount?: number;
  searchQuery?: string;
  children?: ReactNode;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskFolder | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ folder: TaskFolder; x: number; y: number } | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const children = useMemo(() => groupChildren(folders), [folders]);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const currentParentId = typeof selected === "string" && selected !== "all" && selected !== "none" ? selected : null;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleFolders = normalizedSearch ? folders.filter((folder) => folder.name.toLowerCase().includes(normalizedSearch)) : children.get(currentParentId) ?? [];
  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentParentId, folderById), [currentParentId, folderById]);
  const selectedFolderName = normalizedSearch ? `Carpetas encontradas para "${searchQuery.trim()}"` : currentParentId ? folderById.get(currentParentId)?.name ?? "Carpeta" : selected === "all" ? "Todas las tareas" : "Mi unidad";
  const shouldLimitHeight = taskCount > 10;

  const openCreate = (parent: string | null) => {
    setParentId(parent);
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

  const autoScrollWhileDragging = (event: React.DragEvent) => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const edgeSize = 96;
    const maxSpeed = 28;
    const topDistance = event.clientY - rect.top;
    const bottomDistance = rect.bottom - event.clientY;

    if (topDistance < edgeSize) {
      const ratio = Math.max(0, (edgeSize - topDistance) / edgeSize);
      area.scrollTop -= Math.ceil(maxSpeed * ratio);
    } else if (bottomDistance < edgeSize) {
      const ratio = Math.max(0, (edgeSize - bottomDistance) / edgeSize);
      area.scrollTop += Math.ceil(maxSpeed * ratio);
    }
  };

  const scrollWithWheel = (event: React.WheelEvent) => {
    const area = scrollAreaRef.current;
    if (!area || area.scrollHeight <= area.clientHeight) return;
    event.preventDefault();
    area.scrollTop += event.deltaY;
  };

  const dropTask = async (event: React.DragEvent, folderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    const taskId = event.dataTransfer.getData("application/x-taskkeep-task") || event.dataTransfer.getData("text/plain");
    if (taskId) await onMoveTask(taskId, folderId);
  };

  const openFolderMenu = (event: React.MouseEvent, folder: TaskFolder) => {
    event.preventDefault();
    event.stopPropagation();
    setFolderMenu({ folder, x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <section className={`card flex flex-col overflow-hidden ${shouldLimitHeight ? "max-h-[calc(100vh-9rem)] min-h-[34rem]" : ""}`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4">
          <div className="relative">
            <button type="button" onClick={() => setNewMenuOpen((open) => !open)} className="btn btn-primary !px-5 !py-3 text-sm" aria-haspopup="menu" aria-expanded={newMenuOpen}>
              <Plus size={18} /> Nuevo
            </button>
            {newMenuOpen && (
              <div className="absolute left-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] py-2 text-sm font-bold shadow-xl" role="menu">
                <button type="button" onClick={() => { setNewMenuOpen(false); onNewTask(); }} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--paper-deep)]" role="menuitem"><Plus size={16} /> Nueva tarea</button>
                <button type="button" onClick={() => { setNewMenuOpen(false); openCreate(currentParentId); }} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--paper-deep)]" role="menuitem"><Folder size={16} /> Nueva carpeta</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Vistas de carpetas">
            <div onDragOver={(event) => { event.preventDefault(); autoScrollWhileDragging(event); setDropTarget("none"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => void dropTask(event, null)} className={dropTarget === "none" ? "rounded-md ring-2 ring-[var(--primary)]" : ""}>
              <ExplorerButton active={selected === "none"} icon={Inbox} label="Mi unidad" onClick={() => onSelect("none")} />
            </div>
            <ExplorerButton active={selected === "all"} icon={Layers3} label="Todas las tareas" onClick={() => onSelect("all")} />
          </div>
        </div>

        <div ref={scrollAreaRef} onDragOver={autoScrollWhileDragging} onWheel={scrollWithWheel} className={`${shouldLimitHeight ? "min-h-0 flex-1 overflow-y-auto" : "overflow-visible"} space-y-4 p-4 pr-3`}>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--ink-soft)]">
            <BreadcrumbDropButton active={selected === "none"} highlighted={dropTarget === "none"} label="Mi unidad" folderId={null} onSelect={() => onSelect("none")} onDropTask={dropTask} onDropTarget={setDropTarget} onAutoScroll={autoScrollWhileDragging} />
            {!normalizedSearch && breadcrumbs.map((folder) => (
              <span key={folder.id} className="inline-flex items-center gap-2">
                <ChevronRight size={15} className="text-[var(--line-strong)]" />
                <BreadcrumbDropButton active={selected === folder.id} highlighted={dropTarget === folder.id} label={folder.name} folderId={folder.id} onSelect={() => onSelect(folder.id)} onDropTask={dropTask} onDropTarget={setDropTarget} onAutoScroll={autoScrollWhileDragging} />
              </span>
            ))}
            {selected === "all" && !normalizedSearch && <span className="inline-flex items-center gap-2"><ChevronRight size={15} className="text-[var(--line-strong)]" />Todas las tareas</span>}
          </div>

          <div>
            <p className="mb-3 font-display text-sm font-bold text-[var(--ink)]">{selectedFolderName}</p>
            {visibleFolders.length > 0 ? (
              <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {visibleFolders.map((folder) => (
                  <FolderCard key={folder.id} folder={folder} active={selected === folder.id} dropTarget={dropTarget} onSelect={onSelect} onDelete={setDeleteTarget} onContextMenu={openFolderMenu} onDropTarget={setDropTarget} onDrop={dropTask} onAutoScroll={autoScrollWhileDragging} />
                ))}
              </div>
            ) : normalizedSearch ? (
              <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-deep)] px-5 py-6 text-center text-sm text-[var(--ink-soft)]">No hay carpetas que coincidan.</div>
            ) : null}
          </div>

          <div>
            <p className="mb-3 font-display text-sm font-bold text-[var(--ink)]">Tareas</p>
            {!taskItems ? (
              <div className="rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-deep)] px-5 py-8 text-center text-sm text-[var(--ink-soft)]">No hay tareas en esta ubicación.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{taskItems}</div>
            )}
          </div>
        </div>
      </section>

      <AppDialog open={createOpen} onOpenChange={setCreateOpen} title="Nueva carpeta" description="Organiza tus tareas como en Google Drive." size="sm">
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

function BreadcrumbDropButton({ active, highlighted, label, folderId, onSelect, onDropTask, onDropTarget, onAutoScroll }: { active: boolean; highlighted: boolean; label: string; folderId: string | null; onSelect: () => void; onDropTask: (event: React.DragEvent, folderId: string | null) => Promise<void>; onDropTarget: (id: string | null) => void; onAutoScroll: (event: React.DragEvent) => void }) {
  const targetKey = folderId ?? "none";
  return (
    <span onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); onAutoScroll(event); onDropTarget(targetKey); }} onDragLeave={(event) => { event.stopPropagation(); onDropTarget(null); }} onDrop={(event) => void onDropTask(event, folderId)} className={`inline-flex rounded-md ${highlighted ? "ring-2 ring-[var(--primary)]" : ""}`}>
      <button type="button" onClick={onSelect} className={`cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--paper-deep)] ${active ? "bg-[var(--primary-wash)] text-[var(--primary)]" : ""}`}>{label}</button>
    </span>
  );
}

function FolderCard({ folder, active, dropTarget, onSelect, onDelete, onContextMenu, onDropTarget, onDrop, onAutoScroll }: {
  folder: TaskFolder; active: boolean; dropTarget: string | null;
  onSelect: (folder: FolderSelection) => void; onDelete: (folder: TaskFolder) => void; onContextMenu: (event: React.MouseEvent, folder: TaskFolder) => void; onDropTarget: (id: string | null) => void; onDrop: (event: React.DragEvent, folderId: string) => Promise<void>; onAutoScroll: (event: React.DragEvent) => void;
}) {
  return (
    <article onContextMenu={(event) => onContextMenu(event, folder)} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); onAutoScroll(event); onDropTarget(folder.id); }} onDragLeave={(event) => { event.stopPropagation(); onDropTarget(null); }} onDrop={(event) => void onDrop(event, folder.id)} className={`group folder-tab flex h-24 flex-col rounded-lg rounded-tl-none border bg-[var(--surface)] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-[var(--primary)] ring-2 ring-[var(--primary-wash)]" : "border-[var(--line)]"} ${dropTarget === folder.id ? "ring-2 ring-[var(--primary)]" : ""}`}>
      <button type="button" onClick={() => onSelect(folder.id)} className="flex flex-1 cursor-pointer items-start gap-3 text-left">
        <span className="rounded-md bg-[#F3EDDC] p-2 text-[#9A7B24]">{active ? <FolderOpen size={21} /> : <Folder size={21} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-bold text-[var(--ink)]">{folder.name}</span>
          <span className="folio mt-0.5 block uppercase">Carpeta</span>
        </span>
      </button>
      <button type="button" onClick={() => onDelete(folder)} className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-[var(--stamp-red)] opacity-0 hover:bg-[var(--stamp-red-wash)] group-hover:opacity-100 focus:opacity-100" title="Eliminar carpeta">
        <Trash2 size={14} /> Eliminar
      </button>
    </article>
  );
}

function ExplorerButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Folder; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold ${active ? "bg-[var(--primary-wash)] text-[var(--primary)]" : "bg-[var(--paper-deep)] text-[var(--ink)] hover:bg-[var(--line)]"}`}><Icon size={18} /><span>{label}</span></button>;
}

function groupChildren(folders: TaskFolder[]) {
  const map = new Map<string | null, TaskFolder[]>();
  for (const folder of folders) map.set(folder.parent_id, [...(map.get(folder.parent_id) ?? []), folder]);
  return map;
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
