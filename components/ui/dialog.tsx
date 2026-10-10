'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content" onCloseAutoFocus={onCloseAutoFocus}>
          <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {title} options
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="dialog-close" aria-label="Close dialog">
            <X size={20} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
