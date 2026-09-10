"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Confina el foco dentro del diálogo: `aria-modal` por sí solo no lo hace,
      // y sin esto Tab/Shift+Tab se escapan al contenido de detrás.
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Foco inicial al abrir y devolución del foco a quien lo abrió al cerrar. Sin
  // esto, un lector de pantalla o el teclado no entran nunca en el diálogo, o
  // pierden su posición en la página al cerrarlo.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const root = dialogRef.current;
      const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? root)?.focus();
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

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
        ref={dialogRef}
        tabIndex={-1}
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
