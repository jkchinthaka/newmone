import { BadRequestException, Injectable, PipeTransform, type ArgumentMetadata } from "@nestjs/common";
import { getMetadataStorage, registerDecorator, type ValidationOptions } from "class-validator";

/**
 * Required strings must satisfy trim(value).length > 0 (QA: whitespace-only names were
 * accepted and stored as ""). Two layers, both reusable:
 *
 * 1. `@IsNotBlank()` – explicit decorator for fields that may be omitted (PATCH) but must
 *    never be blanked when provided (first name, property name, ...).
 * 2. `NotBlankStringsPipe` – global pipe that applies the same rule to every DTO string
 *    that is required (no @IsOptional) or already declares @IsNotEmpty / @MinLength(>=1),
 *    including nested DTOs. Runs after ValidationPipe on the transformed instance.
 */

export const IS_NOT_BLANK = "isNotBlank";

export function isBlankString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

export function IsNotBlank(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: IS_NOT_BLANK,
      target: object.constructor,
      propertyName: String(propertyName),
      options: { message: `${String(propertyName)} must not be blank`, ...validationOptions },
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true; // presence is @IsOptional/@IsDefined's job
          return !isBlankString(value);
        }
      }
    });
  };
}

type FieldRule = { property: string; mustNotBeBlank: boolean; isArray: boolean };

const ruleCache = new WeakMap<Function, FieldRule[]>();

/** Derive "must not be blank" properties from class-validator metadata (cached per class). */
export function notBlankRulesFor(target: Function): FieldRule[] {
  const cached = ruleCache.get(target);
  if (cached) return cached;

  const metadatas = getMetadataStorage().getTargetValidationMetadatas(target, "", true, false);
  const byProperty = new Map<string, { optional: boolean; isString: boolean; nonEmpty: boolean; each: boolean }>();
  for (const meta of metadatas) {
    const entry = byProperty.get(meta.propertyName) ?? { optional: false, isString: false, nonEmpty: false, each: false };
    const name = (meta as { name?: string }).name ?? "";
    if (meta.type === "conditionalValidation") entry.optional = true;
    if (name === "isString") {
      entry.isString = true;
      entry.each = entry.each || Boolean(meta.each);
    }
    if (name === "isNotEmpty" || name === IS_NOT_BLANK) entry.nonEmpty = true;
    if (name === "minLength" && Number(meta.constraints?.[0] ?? 0) >= 1) entry.nonEmpty = true;
    byProperty.set(meta.propertyName, entry);
  }

  const rules: FieldRule[] = [];
  for (const [property, entry] of byProperty) {
    const required = entry.isString && !entry.optional;
    if (required || entry.nonEmpty) {
      rules.push({ property, mustNotBeBlank: true, isArray: entry.each });
    }
  }
  ruleCache.set(target, rules);
  return rules;
}

/** Returns dotted paths of blank required strings, recursing into nested DTO instances. */
export function findBlankRequiredStrings(instance: unknown, prefix = "", seen = new Set<unknown>()): string[] {
  if (!instance || typeof instance !== "object" || seen.has(instance)) return [];
  seen.add(instance);

  if (Array.isArray(instance)) {
    return instance.flatMap((item, index) => findBlankRequiredStrings(item, `${prefix}[${index}]`, seen));
  }

  const ctor = (instance as object).constructor;
  const problems: string[] = [];
  if (ctor && ctor !== Object) {
    for (const rule of notBlankRulesFor(ctor)) {
      const value = (instance as Record<string, unknown>)[rule.property];
      const path = prefix ? `${prefix}.${rule.property}` : rule.property;
      if (rule.isArray && Array.isArray(value)) {
        value.forEach((item, index) => {
          if (isBlankString(item)) problems.push(`${path}[${index}]`);
        });
      } else if (isBlankString(value)) {
        problems.push(path);
      }
    }
  }

  for (const [key, value] of Object.entries(instance as Record<string, unknown>)) {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      problems.push(...findBlankRequiredStrings(value, prefix ? `${prefix}.${key}` : key, seen));
    }
  }
  return problems;
}

@Injectable()
export class NotBlankStringsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "body" && metadata.type !== "query") return value;
    if (!metadata.metatype || [String, Boolean, Number, Array, Object].includes(metadata.metatype as never)) {
      return value;
    }
    const blank = findBlankRequiredStrings(value);
    if (blank.length > 0) {
      const messages = blank.map((path) => `${path} must not be blank`);
      throw new BadRequestException({
        message: messages,
        fieldErrors: Object.fromEntries(blank.map((path) => [path, [`${path} must not be blank`]])),
        error: "Bad Request"
      });
    }
    return value;
  }
}
