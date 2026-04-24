import { SetMetadata } from "@nestjs/common";

export const ENTITLEMENT_METADATA_KEY = "required-entitlement";

export type EntitlementRequirement = {
  key: string;
  quantity: number;
};

export function RequireEntitlement(key: string, quantity = 1) {
  return SetMetadata(ENTITLEMENT_METADATA_KEY, {
    key,
    quantity
  } satisfies EntitlementRequirement);
}
