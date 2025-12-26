"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | undefined>(
  undefined
);

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen;

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within Dialog");

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => context.onOpenChange(true),
    } as any);
  }

  return <div onClick={() => context.onOpenChange(true)}>{children}</div>;
}

export function DialogContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);

  if (!context) throw new Error("DialogContent must be used within Dialog");

  // Ensure we're on the client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!context.open || !mounted) return null;

  // Use portal to render at document body level to avoid positioning issues
  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        style={{ zIndex: 10000 }}
        onClick={() => context.onOpenChange(false)}
      />
      {/* Content - Centered using inline transform styles */}
      <div
        className="fixed pointer-events-none p-4 w-full"
        style={{
          zIndex: 10001,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "32rem", // max-w-lg equivalent
        }}
      >
        <div
          className={`relative bg-[#15171C] border border-[#23262F] rounded-lg shadow-lg p-6 w-full max-h-[90vh] overflow-y-auto pointer-events-auto ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );

  // Render to document.body using portal
  return createPortal(modalContent, document.body);
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={`text-2xl font-bold mb-2 ${className}`}>{children}</h2>;
}

export function DialogDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-sm text-[#8E9094] ${className}`}>{children}</p>;
}
