"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import type { DataTableColumn } from "@/components/ui/data-table";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  createBuilding,
  createFloor,
  createProperty,
  createRoom,
  listBuildings,
  listFloors,
  listProperties,
  listRooms,
  updateBuilding,
  updateFloor,
  updateProperty,
  updateRoom
} from "@/lib/facilities-api";
import {
  canManageFacilities,
  canViewFacilities,
  formatFacilityRoomType,
  getFacilityLevelLabel,
  type FacilityBuilding,
  type FacilityFloor,
  type FacilityHierarchyLevel,
  type FacilityProperty,
  type FacilityRoom,
  type FacilitySelection
} from "@/lib/facilities";
import { extractRoleName } from "@/lib/role-redirect";
import { getStoredPermissions } from "@/lib/user-role";
import { useCurrentUser } from "@/lib/use-current-user";

import {
  EMPTY_FACILITY_FORM,
  FacilityEntityDialog,
  type FacilityEntityFormValues
} from "./facility-entity-dialog";
import { FacilityEntityTable, FacilityStatusBadge } from "./facility-entity-table";
import { FacilityHierarchyPanel } from "./facility-hierarchy-panel";

type DialogState = {
  open: boolean;
  mode: "create" | "edit";
  level: FacilityHierarchyLevel;
  entityId: string | null;
  values: FacilityEntityFormValues;
};

const INITIAL_DIALOG: DialogState = {
  open: false,
  mode: "create",
  level: "property",
  entityId: null,
  values: EMPTY_FACILITY_FORM
};

type FacilityEntityRow = FacilityProperty | FacilityBuilding | FacilityFloor | FacilityRoom;

export function FacilitiesPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const [permissions, setPermissions] = useState<string[]>([]);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [selection, setSelection] = useState<FacilitySelection>({
    property: null,
    building: null,
    floor: null
  });
  const [level, setLevel] = useState<FacilityHierarchyLevel>("property");
  const [rows, setRows] = useState<FacilityEntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(INITIAL_DIALOG);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPermissions(getStoredPermissions());
  }, []);

  const canView = canViewFacilities(roleName, permissions.length ? permissions : getStoredPermissions());
  const canManage = canManageFacilities(roleName, permissions.length ? permissions : getStoredPermissions());

  const currentLevelLabel = getFacilityLevelLabel(level);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { includeInactive, q: debouncedSearch.trim() || undefined };

      if (level === "property") {
        setRows(await listProperties(params));
        return;
      }

      if (level === "building" && selection.property) {
        setRows(await listBuildings({ ...params, propertyId: selection.property.id }));
        return;
      }

      if (level === "floor" && selection.building) {
        setRows(await listFloors({ ...params, buildingId: selection.building.id }));
        return;
      }

      if (level === "room" && selection.floor) {
        setRows(await listRooms({ ...params, floorId: selection.floor.id }));
        return;
      }

      setRows([]);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, includeInactive, level, selection.building, selection.floor, selection.property]);

  useEffect(() => {
    if (canView) {
      void loadRows();
    }
  }, [canView, loadRows]);

  const openCreateDialog = () => {
    setDialog({
      open: true,
      mode: "create",
      level,
      entityId: null,
      values: EMPTY_FACILITY_FORM
    });
  };

  const openEditDialog = (entity: FacilityEntityRow) => {
    setDialog({
      open: true,
      mode: "edit",
      level,
      entityId: entity.id,
      values: {
        name: entity.name,
        code: "code" in entity ? entity.code ?? "" : "",
        address: "address" in entity ? entity.address ?? "" : "",
        description: "description" in entity ? entity.description ?? "" : "",
        levelNumber: "levelNumber" in entity && entity.levelNumber != null ? String(entity.levelNumber) : "",
        roomType: "roomType" in entity ? entity.roomType ?? "" : ""
      }
    });
  };

  const handleNavigate = (target: "property" | "building" | "floor") => {
    if (target === "property") {
      setSelection({ property: null, building: null, floor: null });
      setLevel("property");
      return;
    }

    if (target === "building") {
      setSelection((current) => ({ property: current.property, building: null, floor: null }));
      setLevel("building");
      return;
    }

    setSelection((current) => ({
      property: current.property,
      building: current.building,
      floor: null
    }));
    setLevel("floor");
  };

  const handleRowOpen = (row: FacilityEntityRow) => {
    if (level === "property") {
      setSelection({ property: row as FacilityProperty, building: null, floor: null });
      setLevel("building");
      return;
    }

    if (level === "building") {
      setSelection((current) => ({
        property: current.property,
        building: row as FacilityBuilding,
        floor: null
      }));
      setLevel("floor");
      return;
    }

    if (level === "floor") {
      setSelection((current) => ({
        property: current.property,
        building: current.building,
        floor: row as FacilityFloor
      }));
      setLevel("room");
    }
  };

  const toggleActive = async (entity: FacilityEntityRow, nextActive: boolean) => {
    const actionLabel = nextActive ? "reactivate" : "deactivate";
    const confirmed = await confirm({
      title: `${nextActive ? "Reactivate" : "Deactivate"} ${level}?`,
      description: `${entity.name} will be marked ${nextActive ? "active" : "inactive"}. Records are not deleted.`,
      confirmLabel: nextActive ? "Reactivate" : "Deactivate",
      variant: nextActive ? "default" : "destructive"
    });

    if (!confirmed) {
      return;
    }

    try {
      if (level === "property") {
        await updateProperty(entity.id, { isActive: nextActive });
      } else if (level === "building") {
        await updateBuilding(entity.id, { isActive: nextActive });
      } else if (level === "floor") {
        await updateFloor(entity.id, { isActive: nextActive });
      } else {
        await updateRoom(entity.id, { isActive: nextActive });
      }

      toast.success(`Record ${actionLabel}d`);
      await loadRows();
    } catch (toggleError) {
      toast.error(getApiErrorMessage(toggleError, `Could not ${actionLabel} record.`));
    }
  };

  const handleDialogSubmit = async () => {
    const values = dialog.values;
    if (!values.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    setSubmitting(true);

    try {
      if (dialog.mode === "create") {
        if (level === "property") {
          if (!values.code.trim()) {
            toast.error("Code is required.");
            return;
          }
          await createProperty({
            name: values.name.trim(),
            code: values.code.trim(),
            address: values.address.trim() || undefined
          });
        } else if (level === "building" && selection.property) {
          if (!values.code.trim()) {
            toast.error("Code is required.");
            return;
          }
          await createBuilding({
            propertyId: selection.property.id,
            name: values.name.trim(),
            code: values.code.trim(),
            description: values.description.trim() || undefined
          });
        } else if (level === "floor" && selection.building) {
          await createFloor({
            buildingId: selection.building.id,
            name: values.name.trim(),
            levelNumber: values.levelNumber.trim() ? Number(values.levelNumber) : undefined
          });
        } else if (level === "room" && selection.floor) {
          await createRoom({
            floorId: selection.floor.id,
            name: values.name.trim(),
            code: values.code.trim() || undefined,
            roomType: values.roomType || undefined
          });
        }
        toast.success(`${currentLevelLabel.slice(0, -1)} created`);
      } else if (dialog.entityId) {
        if (level === "property") {
          await updateProperty(dialog.entityId, {
            name: values.name.trim(),
            code: values.code.trim() || undefined,
            address: values.address.trim() || undefined
          });
        } else if (level === "building") {
          await updateBuilding(dialog.entityId, {
            name: values.name.trim(),
            code: values.code.trim() || undefined,
            description: values.description.trim() || undefined
          });
        } else if (level === "floor") {
          await updateFloor(dialog.entityId, {
            name: values.name.trim(),
            levelNumber: values.levelNumber.trim() ? Number(values.levelNumber) : undefined
          });
        } else {
          await updateRoom(dialog.entityId, {
            name: values.name.trim(),
            code: values.code.trim() || undefined,
            roomType: values.roomType || undefined
          });
        }
        toast.success("Changes saved");
      }

      setDialog(INITIAL_DIALOG);
      await loadRows();
    } catch (submitError) {
      toast.error(getApiErrorMessage(submitError, "Could not save facility record."));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo((): DataTableColumn<Record<string, unknown>>[] => {
    const statusColumn: DataTableColumn<Record<string, unknown>> = {
      id: "status",
      header: "Status",
      cell: (row) => <FacilityStatusBadge active={Boolean(row.isActive)} />
    };

    if (level === "property") {
      return [
        { id: "name", header: "Name", cell: (row) => <span className="font-medium text-slate-900">{String(row.name)}</span> },
        { id: "code", header: "Code", cell: (row) => String(row.code) },
        { id: "address", header: "Address", cell: (row) => String(row.address ?? "—"), hideOnMobile: true },
        statusColumn
      ];
    }

    if (level === "building") {
      return [
        { id: "name", header: "Name", cell: (row) => <span className="font-medium text-slate-900">{String(row.name)}</span> },
        { id: "code", header: "Code", cell: (row) => String(row.code) },
        {
          id: "description",
          header: "Description",
          cell: (row) => String(row.description ?? "—"),
          hideOnMobile: true
        },
        statusColumn
      ];
    }

    if (level === "floor") {
      return [
        { id: "name", header: "Name", cell: (row) => <span className="font-medium text-slate-900">{String(row.name)}</span> },
        {
          id: "levelNumber",
          header: "Level",
          cell: (row) => (row.levelNumber == null ? "—" : String(row.levelNumber))
        },
        statusColumn
      ];
    }

    return [
      { id: "name", header: "Name", cell: (row) => <span className="font-medium text-slate-900">{String(row.name)}</span> },
      { id: "code", header: "Code", cell: (row) => String(row.code ?? "—") },
      {
        id: "roomType",
        header: "Type",
        cell: (row) => formatFacilityRoomType(row.roomType as never),
        hideOnMobile: true
      },
      statusColumn
    ];
  }, [level]);

  if (!canView) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <PermissionState description="Your role does not include facility hierarchy access." />
      </div>
    );
  }

  const parentMissing =
    (level === "building" && !selection.property) ||
    (level === "floor" && !selection.building) ||
    (level === "room" && !selection.floor);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      {confirmDialog}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-700" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Manage the property → building → floor → room hierarchy for your tenant. Select a row to drill down.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadRows()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          {canManage && !parentMissing ? (
            <button
              type="button"
              onClick={openCreateDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} aria-hidden="true" />
              Add {currentLevelLabel.slice(0, -1).toLowerCase()}
            </button>
          ) : null}
        </div>
      </header>

      {(selection.property || selection.building || selection.floor) && (
        <FacilityHierarchyPanel selection={selection} onNavigate={handleNavigate} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{currentLevelLabel}</h2>
          <p className="text-xs text-slate-500">
            {canManage ? "You can create, edit, and deactivate records." : "Read-only hierarchy view."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${currentLevelLabel.toLowerCase()}…`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64"
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </div>

      {parentMissing ? (
        <ErrorState
          title="Select a parent level"
          description="Choose a property, building, or floor above before managing this level."
        />
      ) : loading ? (
        <InlineLoadingState label={`Loading ${currentLevelLabel.toLowerCase()}…`} />
      ) : error ? (
        <ErrorState
          title={`Could not load ${currentLevelLabel.toLowerCase()}`}
          error={error}
          onRetry={() => void loadRows()}
        />
      ) : (
        <FacilityEntityTable
          rows={rows as Array<Record<string, unknown>>}
          columns={columns}
          getRowId={(row) => String(row.id)}
          ariaLabel={`${currentLevelLabel} table`}
          emptyTitle={
            level === "property" ? "No facilities created yet" : `No ${currentLevelLabel.toLowerCase()} yet`
          }
          emptyDescription={
            canManage
              ? `Create the first ${currentLevelLabel.slice(0, -1).toLowerCase()} to start building your hierarchy.`
              : "No records are available for your tenant at this level."
          }
          emptyActionLabel={canManage ? `Add ${currentLevelLabel.slice(0, -1).toLowerCase()}` : undefined}
          onEmptyAction={canManage ? openCreateDialog : undefined}
          onRowClick={
            level === "room" ? undefined : (row) => handleRowOpen(row as FacilityEntityRow)
          }
          renderActions={
            canManage
              ? (row) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${String(row.name)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDialog(row as FacilityEntityRow);
                      }}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={row.isActive ? "Deactivate" : "Reactivate"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleActive(row as FacilityEntityRow, !row.isActive);
                      }}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                    >
                      <Power size={16} aria-hidden="true" />
                    </button>
                  </div>
                )
              : undefined
          }
        />
      )}

      <FacilityEntityDialog
        open={dialog.open}
        level={dialog.level}
        mode={dialog.mode}
        values={dialog.values}
        submitting={submitting}
        onChange={(values) => setDialog((current) => ({ ...current, values }))}
        onSubmit={() => void handleDialogSubmit()}
        onClose={() => (submitting ? undefined : setDialog(INITIAL_DIALOG))}
      />
    </div>
  );
}
