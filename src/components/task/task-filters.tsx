"use client";

import { CalendarDays, ChevronDown, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

interface PersonOption { id: string; full_name: string; }

export function TaskFilters({
  search,
  status,
  priority,
  responsible = "",
  deadlineFrom,
  deadlineTo,
  sort,
  pinned = false,
  responsibles = [],
  showResponsible = false,
  showPinned = false,
  viewMode,
  onSearch,
  onStatus,
  onPriority,
  onResponsible,
  onDeadlineFrom,
  onDeadlineTo,
  onSort,
  onPinned,
  onViewMode,
}: {
  search: string;
  status: string;
  priority: string;
  responsible?: string;
  deadlineFrom: string;
  deadlineTo: string;
  sort: string;
  pinned?: boolean;
  responsibles?: PersonOption[];
  showResponsible?: boolean;
  showPinned?: boolean;
  viewMode: "cards" | "list";
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onPriority: (value: string) => void;
  onResponsible?: (value: string) => void;
  onDeadlineFrom: (value: string) => void;
  onDeadlineTo: (value: string) => void;
  onSort: (value: string) => void;
  onPinned?: (value: boolean) => void;
  onViewMode: (value: "cards" | "list") => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const active = [
    priority && { label: `Prioridad: ${priorityLabel(priority)}`, clear: () => onPriority("") },
    responsible && { label: `Responsable: ${responsibles.find((person) => person.id === responsible)?.full_name ?? "Seleccionado"}`, clear: () => onResponsible?.("") },
    deadlineFrom && { label: `Desde: ${formatDate(deadlineFrom)}`, clear: () => onDeadlineFrom("") },
    deadlineTo && { label: `Hasta: ${formatDate(deadlineTo)}`, clear: () => onDeadlineTo("") },
    pinned && { label: "Solo fijadas", clear: () => onPinned?.(false) },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  const clearAll = () => {
    onSearch("");
    onStatus("");
    onPriority("");
    onResponsible?.("");
    onDeadlineFrom("");
    onDeadlineTo("");
    onPinned?.(false);
    onSort("deadline_asc");
  };

  return (
    <div className="mb-6 mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por título o descripción" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm transition focus:bg-white" />
          {search && <button onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200" aria-label="Limpiar búsqueda"><X size={16} /></button>}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {[["", "Todas"], ["pending", "Pendientes"], ["in_progress", "En curso"], ["completed", "Completadas"]].map(([value, label]) => (
            <button key={value} onClick={() => onStatus(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${status === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
          ))}
        </div>
        <button onClick={() => setAdvanced((value) => !value)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${advanced || active.length ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <SlidersHorizontal size={17} /> Filtros
          {active.length > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">{active.length}</span>}
          <ChevronDown size={15} className={`transition ${advanced ? "rotate-180" : ""}`} />
        </button>
        <div className="flex shrink-0 rounded-xl bg-slate-100 p-1">
          <button onClick={() => onViewMode("cards")} className={`rounded-lg p-2 ${viewMode === "cards" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`} aria-label="Vista de tarjetas"><LayoutGrid size={19} /></button>
          <button onClick={() => onViewMode("list")} className={`rounded-lg p-2 ${viewMode === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`} aria-label="Vista de lista"><List size={19} /></button>
        </div>
      </div>

      {advanced && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FilterField label="Prioridad">
              <select value={priority} onChange={(event) => onPriority(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todas</option><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select>
            </FilterField>
            {showResponsible && <FilterField label="Responsable"><select value={responsible} onChange={(event) => onResponsible?.(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todos</option>{responsibles.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></FilterField>}
            <FilterField label="Fecha límite desde"><div className="relative"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="date" value={deadlineFrom} onChange={(event) => onDeadlineFrom(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm" /></div></FilterField>
            <FilterField label="Fecha límite hasta"><div className="relative"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="date" value={deadlineTo} onChange={(event) => onDeadlineTo(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm" /></div></FilterField>
            <FilterField label="Ordenar por"><select value={sort} onChange={(event) => onSort(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="deadline_asc">Deadline más cercano</option><option value="deadline_desc">Deadline más lejano</option><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="priority">Mayor prioridad</option><option value="status">Estado</option></select></FilterField>
            {showPinned && <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"><input type="checkbox" checked={pinned} onChange={(event) => onPinned?.(event.target.checked)} className="h-4 w-4 accent-indigo-600" /> Mostrar solo fijadas</label>}
          </div>
        </div>
      )}

      {(active.length > 0 || search) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Activos</span>
          {search && <FilterChip label={`Búsqueda: “${search}”`} onClear={() => onSearch("")} />}
          {active.map((item) => <FilterChip key={item.label} label={item.label} onClear={item.clear} />)}
          <button onClick={clearAll} className="ml-auto text-xs font-bold text-indigo-700 hover:underline">Limpiar todo</button>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{label}<button onClick={onClear} className="rounded-full p-0.5 hover:bg-slate-200" aria-label={`Quitar ${label}`}><X size={12} /></button></span>;
}

function priorityLabel(value: string) {
  return ({ low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" } as Record<string, string>)[value] ?? value;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}
