import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  variant?: "destructive" | "default";
  isPending?: boolean;
}

// Themed replacement for window.confirm() — a native browser dialog can
// never be CSS-styled, so every destructive/consequential confirmation in
// the app routes through this instead, matching the shape already
// hand-rolled per-page (RecurringTemplatesPage, ProformasPage, etc.).
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting...",
  variant = "destructive",
  isPending = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={isPending}>
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
