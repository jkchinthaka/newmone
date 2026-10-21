import { DataTable as BaseDataTable, type DataTableProps } from "@/components/ui/data-table";

import { cn } from "./cn";

export function DataTable<T>(props: DataTableProps<T>) {
  return <BaseDataTable {...props} className={cn("rounded-card border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900", props.className)} />;
}

export type { DataTableColumn, DataTablePagination, DataTableProps, SortDirection } from "@/components/ui/data-table";
