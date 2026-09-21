/**
 * Pure helpers for Direct Work Order create HCI (title automation, domain copy).
 * Kept free of React so unit tests can lock domain correctness without mounting UI.
 */
import type { JobDomain } from "@/lib/job-domain";
import { JOB_DOMAIN_LABELS } from "@/lib/job-domain";

export type CreateFormDomain = JobDomain;

export function createFormTitle(domain: CreateFormDomain | null | undefined): string {
  if (!domain) return "Create Work Order";
  return `Create ${JOB_DOMAIN_LABELS[domain]} Work Order`;
}

/**
 * Build a short, non-misleading title from the problem description and optional
 * entity label. Does not invent equipment names that were not provided.
 */
export function suggestWorkOrderTitle(input: {
  description: string;
  entityLabel?: string | null;
  maxLength?: number;
}): string {
  const maxLength = input.maxLength ?? 80;
  const description = input.description.replace(/\s+/g, " ").trim();
  if (!description) {
    return "";
  }

  const entity = input.entityLabel?.replace(/\s+/g, " ").trim();
  let title: string;
  if (entity) {
    const shortened =
      description.length > 48 ? `${description.slice(0, 45).trimEnd()}…` : description;
    title = `${entity} — ${shortened}`;
  } else {
    title = description.length > maxLength ? `${description.slice(0, maxLength - 1).trimEnd()}…` : description;
  }

  return title.length > maxLength ? `${title.slice(0, maxLength - 1).trimEnd()}…` : title;
}

/** Fields that belong on the primary (non-More-options) surface per domain. */
export function primaryCreateFields(domain: CreateFormDomain): {
  showAsset: boolean;
  showVehicle: boolean;
  showLocation: boolean;
  showWorkType: boolean;
  showServiceCategory: boolean;
  assetLabel: string;
  problemLabel: string;
} {
  switch (domain) {
    case "MACHINERY":
      return {
        showAsset: true,
        showVehicle: false,
        showLocation: false,
        showWorkType: true,
        showServiceCategory: false,
        assetLabel: "Machine / Asset",
        problemLabel: "Problem / Work Required"
      };
    case "VEHICLE":
      return {
        showAsset: false,
        showVehicle: true,
        showLocation: false,
        showWorkType: true,
        showServiceCategory: false,
        assetLabel: "Asset",
        problemLabel: "Problem / Work Required"
      };
    case "SERVICE":
      return {
        showAsset: false,
        showVehicle: false,
        showLocation: true,
        showWorkType: false,
        showServiceCategory: true,
        assetLabel: "Asset",
        problemLabel: "Problem / Request"
      };
  }
}

/**
 * Regression guard: when the user creates from a known domain lane without an
 * asset/vehicle, the explicit jobDomain must still win over SERVICE inference.
 */
export function resolveCreateJobDomain(input: {
  explicitJobDomain?: string | null;
  assetId?: string | null;
  vehicleId?: string | null;
}): string | undefined {
  const explicit = input.explicitJobDomain?.trim().toUpperCase();
  if (explicit === "MACHINERY" || explicit === "SERVICE" || explicit === "VEHICLE") {
    return explicit;
  }
  return undefined;
}
