"use client";

import { useCallback, useRef, useState } from "react";

import { PromptDialog, type PromptDialogOptions } from "@/components/ui/prompt-dialog";

type ActivePrompt = PromptDialogOptions & { open: true };

export function usePromptDialog() {
  const [active, setActive] = useState<ActivePrompt | null>(null);
  const resolverRef = useRef<((value: string | null) => void) | null>(null);

  const prompt = useCallback((options: PromptDialogOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setActive({ ...options, open: true });
    });
  }, []);

  const close = useCallback((result: string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setActive(null);
  }, []);

  const dialog = active ? (
    <PromptDialog
      {...active}
      onCancel={() => close(null)}
      onSubmit={(value) => close(value)}
    />
  ) : null;

  return { prompt, dialog };
}
