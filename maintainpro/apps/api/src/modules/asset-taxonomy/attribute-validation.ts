import { BadRequestException } from "@nestjs/common";
import { AssetAttributeDataType } from "@prisma/client";

export type AttributeDefinitionLike = {
  key: string;
  label: string;
  dataType: AssetAttributeDataType;
  required: boolean;
  options: string[];
  minValue: number | null;
  maxValue: number | null;
  isActive: boolean;
};

/**
 * Custom attributes are stored as Json on Asset but MUST be validated
 * against active AssetAttributeDefinition rows — never accept arbitrary keys.
 */
export function validateCustomAttributes(
  definitions: AttributeDefinitionLike[],
  values: Record<string, unknown> | null | undefined,
  options: { allowPartial?: boolean } = {}
): Record<string, unknown> {
  const active = definitions.filter((d) => d.isActive);
  const incoming = values ?? {};
  if (typeof incoming !== "object" || Array.isArray(incoming)) {
    throw new BadRequestException("customAttributes must be an object");
  }

  const allowedKeys = new Set(active.map((d) => d.key));
  for (const key of Object.keys(incoming)) {
    if (!allowedKeys.has(key)) {
      throw new BadRequestException(`Unknown or inactive attribute key: ${key}`);
    }
  }

  const result: Record<string, unknown> = {};

  for (const def of active) {
    const hasKey = Object.prototype.hasOwnProperty.call(incoming, def.key);
    const raw = hasKey ? incoming[def.key] : undefined;

    if (!hasKey || raw === undefined || raw === null || raw === "") {
      if (def.required && !options.allowPartial) {
        throw new BadRequestException(`Required attribute missing: ${def.label} (${def.key})`);
      }
      continue;
    }

    result[def.key] = coerceAndValidate(def, raw);
  }

  return result;
}

function coerceAndValidate(def: AttributeDefinitionLike, raw: unknown): unknown {
  switch (def.dataType) {
    case AssetAttributeDataType.TEXT: {
      if (typeof raw !== "string") {
        throw new BadRequestException(`${def.key} must be text`);
      }
      return raw.trim();
    }
    case AssetAttributeDataType.NUMBER: {
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        throw new BadRequestException(`${def.key} must be a number`);
      }
      if (def.minValue != null && num < def.minValue) {
        throw new BadRequestException(`${def.key} must be >= ${def.minValue}`);
      }
      if (def.maxValue != null && num > def.maxValue) {
        throw new BadRequestException(`${def.key} must be <= ${def.maxValue}`);
      }
      return num;
    }
    case AssetAttributeDataType.BOOLEAN: {
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      throw new BadRequestException(`${def.key} must be boolean`);
    }
    case AssetAttributeDataType.DATE: {
      const date = typeof raw === "string" || raw instanceof Date ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) {
        throw new BadRequestException(`${def.key} must be a valid date`);
      }
      return date.toISOString();
    }
    case AssetAttributeDataType.SELECT: {
      if (typeof raw !== "string") {
        throw new BadRequestException(`${def.key} must be a select option string`);
      }
      if (def.options.length > 0 && !def.options.includes(raw)) {
        throw new BadRequestException(`${def.key} must be one of: ${def.options.join(", ")}`);
      }
      return raw;
    }
    default:
      throw new BadRequestException(`Unsupported attribute data type for ${def.key}`);
  }
}
