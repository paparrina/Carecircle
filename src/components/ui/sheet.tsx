"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Hoja inferior accesible y sin dependencias (móvil primero).
 * Se renderiza en un portal sobre <body>: así ningún ancestro con
 * backdrop-filter/transform (p. ej. la cabecera con blur) puede
 * "atrapar" su position:fixed.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-t-xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
          "max-h-[85dvh] overflow-y-auto shadow-[0_-4px_24px_rgba(31,41,51,0.15)]"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex min-h-touch min-w-[48px] items-center justify-center rounded-md text-ink-secondary hover:bg-background"
            aria-label="Cerrar"
          >
            <X size={26} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
