"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import esLocale from "@fullcalendar/core/locales/es";
import type { Task } from "@/types";

export function TaskCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    fetch("/api/tasks?size=50").then((response) => response.json()).then((body) => setTasks(body.data ?? []));
  }, []);
  const events = tasks.map((task) => ({ id: task.id, title: task.title, date: task.deadline.slice(0, 10), color: task.color ?? "#4f46e5" }));
  return (
    <section>
      <p className="text-sm font-bold text-indigo-600">PLANIFICACIÓN</p>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Calendario</h1>
      <div className="card overflow-hidden p-4"><FullCalendar plugins={[dayGridPlugin]} initialView="dayGridMonth" locale={esLocale} events={events} height="auto" /></div>
      <div className="card mt-6 p-5">
        <h2 className="font-bold">Alternativa en lista</h2>
        <ul className="mt-3 divide-y divide-slate-200">
          {tasks.map((task) => <li key={task.id} className="flex justify-between gap-4 py-3 text-sm"><span>{task.title}</span><time dateTime={task.deadline}>{new Date(task.deadline).toLocaleDateString("es-EC")}</time></li>)}
        </ul>
      </div>
    </section>
  );
}
