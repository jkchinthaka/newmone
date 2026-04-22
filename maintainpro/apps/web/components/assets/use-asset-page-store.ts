import { create } from "zustand";

export type AssetStatusFilter = "" | "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "RETIRED" | "DISPOSED";
export type AssetCategoryFilter = "" | "MACHINE" | "EQUIPMENT" | "VEHICLE" | "INFRASTRUCTURE" | "OTHER";
export type AssetSortField = "assetTag" | "name" | "category" | "status" | "createdAt" | "location";

export type AssetColumnKey =
  | "assetTag"
  | "name"
  | "category"
  | "status"
  | "location"
  | "condition"
  | "lastServiceDate"
  | "qr"
  | "actions";

export interface AssetQueryFilters {
  search: string;
  status: AssetStatusFilter;
  category: AssetCategoryFilter;
  location: string;
  sortBy: AssetSortField;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: AssetQueryFilters = {
  search: "",
  status: "",
  category: "",
  location: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  pageSize: 25
};

const DEFAULT_VISIBLE_COLUMNS: Record<AssetColumnKey, boolean> = {
  assetTag: true,
  name: true,
  category: true,
  status: true,
  location: true,
  condition: true,
  lastServiceDate: true,
  qr: true,
  actions: true
};

interface AssetPageState {
  filters: AssetQueryFilters;
  selectedIds: string[];
  visibleColumns: Record<AssetColumnKey, boolean>;
  highlightedRowId: string | null;
  setFilters: (patch: Partial<AssetQueryFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sortBy: AssetSortField) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;
  toggleManySelection: (ids: string[], selected: boolean) => void;
  toggleColumn: (column: AssetColumnKey) => void;
  setHighlightedRow: (id: string | null) => void;
}

export const useAssetPageStore = create<AssetPageState>((set, get) => ({
  filters: DEFAULT_FILTERS,
  selectedIds: [],
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  highlightedRowId: null,
  setFilters: (patch) =>
    set((state) => ({
      filters: {
        ...state.filters,
        ...patch,
        page:
          patch.page !== undefined || patch.pageSize !== undefined
            ? patch.page ?? state.filters.page
            : 1
      }
    })),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
  setPage: (page) => set((state) => ({ filters: { ...state.filters, page } })),
  setPageSize: (pageSize) => set((state) => ({ filters: { ...state.filters, pageSize, page: 1 } })),
  setSort: (sortBy) =>
    set((state) => {
      const sortOrder =
        state.filters.sortBy === sortBy
          ? state.filters.sortOrder === "asc"
            ? "desc"
            : "asc"
          : "asc";

      return {
        filters: {
          ...state.filters,
          sortBy,
          sortOrder,
          page: 1
        }
      };
    }),
  clearSelection: () => set({ selectedIds: [] }),
  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id]
    })),
  toggleManySelection: (ids, selected) =>
    set((state) => {
      const current = new Set(state.selectedIds);
      ids.forEach((id) => {
        if (selected) {
          current.add(id);
        } else {
          current.delete(id);
        }
      });
      return { selectedIds: Array.from(current) };
    }),
  toggleColumn: (column) =>
    set((state) => ({
      visibleColumns: {
        ...state.visibleColumns,
        [column]: !state.visibleColumns[column]
      }
    })),
  setHighlightedRow: (id) => set({ highlightedRowId: id })
}));

export function hasActiveFilters(filters: AssetQueryFilters) {
  return Boolean(
    filters.search.trim() ||
      filters.status ||
      filters.category ||
      filters.location ||
      filters.sortBy !== DEFAULT_FILTERS.sortBy ||
      filters.sortOrder !== DEFAULT_FILTERS.sortOrder
  );
}
