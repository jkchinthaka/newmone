import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  language: "en" | "es";
  setSidebarOpen: (value: boolean) => void;
  toggleSidebar: () => void;
  setLanguage: (value: "en" | "es") => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  language: "en",
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLanguage: (value) => set({ language: value })
}));
