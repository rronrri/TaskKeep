"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Inbox, Layers3, Plus } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import type { TaskFolder } from "@/types";

export type FolderSelection = "all" | "none" | string;

export function TaskFolderExplorer({ folders, selected, onSelect, onCreate, onMoveTask }: {
  folders: TaskFolder[];
  selected: FolderSelection;
  onSelect: (folder: FolderSelection) => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const children = useMemo(() => groupChildren(folders), [folders]);

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
      if (parentId) setExpanded((current) => new Set(current).add(parentId));
      setCreateOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la carpeta");
    } finally {
      setBusy(false);
    }
  };

  const dropTask = async (event: React.DragEvent, folderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    const taskId = event.dataTransfer.getData("application/x-taskkeep-task") || event.dataTransfer.getData("text/plain");
    if (taskId) await onMoveTask(taskId, folderId);
  };

  return (
    <>
      <aside className="card h-fit overflow-hidden lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div><p className="text-xs font-extrabold uppercase tracking-wide text-indigo-600">Explorador</p><h2 className="font-display font-extrabold">Carpetas</h2></div>
          <button type="button" onClick={() => openCreate(null)} className="rounded-xl bg-indigo-100 p-2 text-indigo-700 hover:bg-indigo-200" title="Nueva carpeta" aria-label="Nueva carpeta"><FolderPlus size={18} /></button>
        </div>
        <nav className="max-h-[65vh] overflow-y-auto p-2" aria-label="Carpetas de tareas">
          <ExplorerButton active={selected === "all"} icon={Layers3} label="Todas las tareas" onClick={() => onSelect("all")} />
          <div onDragOver={(event) => { event.preventDefault(); setDropTarget("none"); }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => void dropTask(event, null)} className={dropTarget === "none" ? "rounded-xl ring-2 ring-indigo-400" : ""}>
            <ExplorerButton active={selected === "none"} icon={Inbox} label="Sin carpeta" onClick={() => onSelect("none")} />
          </div>
          <div className="my-2 border-t border-slate-200" />
          {(children.get(null) ?? []).map((folder) => (
            <FolderNode key={folder.id} folder={folder} depth={0} childrenMap={children} selected={selected} expanded={expanded} dropTarget={dropTarget} onSelect={onSelect} onExpand={(id) => setExpanded((current) => toggleSet(current, id))} onCreate={openCreate} onDropTarget={setDropTarget} onDrop={dropTask} />
          ))}
          {folders.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Crea tu primera carpeta para organizar tareas.</p>}
        </nav>
      </aside>

      <AppDialog open={createOpen} onOpenChange={setCreateOpen} title={parentId ? "Nueva subcarpeta" : "Nueva carpeta"} description={parentId ? "Se creará dentro de la carpeta seleccionada." : "Organiza tus tareas como en un explorador de archivos."} size="sm">
        <div className="space-y-4">
          <label className="block text-sm font-bold">Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFolder(); }} maxLength={80} placeholder="Ej. Proyectos 2026" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 font-bold hover:bg-slate-50">Cancelar</button><button type="button" disabled={busy || !name.trim()} onClick={() => void createFolder()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><Plus size={17} />{busy ? "Creando..." : "Crear"}</button></div>
        </div>
      </AppDialog>
    </>
  );
}

function FolderNode({ folder, depth, childrenMap, selected, expanded, dropTarget, onSelect, onExpand, onCreate, onDropTarget, onDrop }: {
  folder: TaskFolder; depth: number; childrenMap: Map<string | null, TaskFolder[]>; selected: FolderSelection; expanded: Set<string>; dropTarget: string | null;
  onSelect: (folder: FolderSelection) => void; onExpand: (id: string) => void; onCreate: (parentId: string) => void; onDropTarget: (id: string | null) => void; onDrop: (event: React.DragEvent, folderId: string) => Promise<void>;
}) {
  const children = childrenMap.get(folder.id) ?? [];
  const open = expanded.has(folder.id);
  return <div>
    <div onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); onDropTarget(folder.id); }} onDragLeave={(event) => { event.stopPropagation(); onDropTarget(null); }} onDrop={(event) => void onDrop(event, folder.id)} className={`group flex items-center rounded-xl pr-1 ${selected === folder.id ? "bg-indigo-100 text-indigo-800" : "hover:bg-slate-100"} ${dropTarget === folder.id ? "ring-2 ring-indigo-400" : ""}`} style={{ paddingLeft: `${depth * 14 + 4}px` }}>
      <button type="button" onClick={() => children.length > 0 && onExpand(folder.id)} className={`rounded-lg p-1.5 ${children.length === 0 ? "invisible" : ""}`} aria-label={open ? "Contraer carpeta" : "Expandir carpeta"}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
      <button type="button" onClick={() => onSelect(folder.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm font-semibold">{open ? <FolderOpen className="shrink-0 text-amber-600" size={18} /> : <Folder className="shrink-0 text-amber-600" size={18} />}<span className="truncate">{folder.name}</span></button>
      <button type="button" onClick={() => onCreate(folder.id)} className="invisible rounded-lg p-1.5 text-indigo-700 hover:bg-white group-hover:visible focus:visible" title="Crear subcarpeta" aria-label={`Crear subcarpeta en ${folder.name}`}><Plus size={15} /></button>
    </div>
    {open && children.map((child) => <FolderNode key={child.id} folder={child} depth={depth + 1} childrenMap={childrenMap} selected={selected} expanded={expanded} dropTarget={dropTarget} onSelect={onSelect} onExpand={onExpand} onCreate={onCreate} onDropTarget={onDropTarget} onDrop={onDrop} />)}
  </div>;
}

function ExplorerButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Folder; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${active ? "bg-indigo-100 text-indigo-800" : "text-slate-700 hover:bg-slate-100"}`}><Icon size={18} /><span>{label}</span></button>;
}

function groupChildren(folders: TaskFolder[]) {
  const map = new Map<string | null, TaskFolder[]>();
  for (const folder of folders) map.set(folder.parent_id, [...(map.get(folder.parent_id) ?? []), folder]);
  return map;
}

function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
