"use client";

import { useCallback, useRef, useState } from "react";

import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/confirm-dialog";

type ActiveConfirm = ConfirmDialogOptions & { open: true };

export function useConfirmDialog() {
  const [active, setActive] = useState<ActiveConfirm | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setActive({ ...options, open: true });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setActive(null);
  }, []);

  const dialog = active ? (
    <ConfirmDialog
      {...active}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, dialog };
}
