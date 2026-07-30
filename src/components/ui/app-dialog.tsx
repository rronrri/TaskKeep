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
  scrollable = true,
  onPointerDownOutside,
  onInteractOutside,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  scrollable?: boolean;
  // Google Picker (y otros widgets de Google) se inyectan en el DOM fuera del
  // portal de Radix. Sin esto, Radix interpreta esa inyección/interacción como
  // un clic fuera del diálogo y lo cierra solo, antes de que la persona llegue
  // al botón de guardar.
  onPointerDownOutside?: (event: Event) => void;
  onInteractOutside?: (event: Event) => void;
}) {
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" }[size];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(20_28_26/0.6)] backdrop-blur-sm" />
        <Dialog.Content
          onPointerDownOutside={onPointerDownOutside}
          onInteractOutside={onInteractOutside}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[94vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl sm:p-6 animate-[dialog-in_180ms_ease-out] ${scrollable ? "overflow-y-auto" : "overflow-hidden"} ${width}`}>
          <div className="mb-5 border-b border-[var(--line)] pb-4 pr-10 sm:mb-6">
            <Dialog.Title className="font-display text-xl font-bold sm:text-2xl">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-2 text-sm text-[var(--ink-soft)]">{description}</Dialog.Description>}
          </div>
          <Dialog.Close className="absolute right-5 top-5 rounded-md p-2 text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]" aria-label="Cerrar">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
