"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/ui/command-palette";
import {
  filterCommandPaletteItems,
  getCommandPaletteItems,
  isCommandPaletteShortcut,
  shouldIgnoreCommandPaletteShortcut,
  type CommandPaletteItem
} from "@/lib/command-palette";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

export type GlobalCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const [query, setQuery] = useState("");

  const allItems = useMemo(() => getCommandPaletteItems(roleName), [roleName]);
  const filteredItems = useMemo(
    () => filterCommandPaletteItems(allItems, query),
    [allItems, query]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setQuery("");
  }, [onOpenChange]);

  const handleSelect = useCallback(
    (item: CommandPaletteItem) => {
      handleClose();
      router.push(item.href as Route);
    },
    [handleClose, router]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isCommandPaletteShortcut(event)) {
        return;
      }

      if (shouldIgnoreCommandPaletteShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      onOpenChange(!open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <CommandPalette
      items={filteredItems}
      onClose={handleClose}
      onQueryChange={setQuery}
      onSelect={handleSelect}
      open={open}
      query={query}
    />
  );
}
