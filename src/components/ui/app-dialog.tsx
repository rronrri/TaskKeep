"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" }[size];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${width}`}>
          <div className="mb-6 pr-10">
            <Dialog.Title className="font-display text-2xl font-extrabold">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-2 text-sm text-slate-600">{description}</Dialog.Description>}
          </div>
          <Dialog.Close className="absolute right-5 top-5 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
