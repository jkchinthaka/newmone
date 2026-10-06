import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";

function parseOptionalDate(value?: string | null): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

@ValidatorConstraint({ name: "warrantyAfterPurchase", async: false })
export class WarrantyAfterPurchaseConstraint implements ValidatorConstraintInterface {
  validate(warrantyExpiry: string | undefined, args: ValidationArguments) {
    const purchaseDate = parseOptionalDate((args.object as { purchaseDate?: string }).purchaseDate);
    const warrantyDate = parseOptionalDate(warrantyExpiry);
    if (!purchaseDate || !warrantyDate) {
      return true;
    }
    return warrantyDate.getTime() >= purchaseDate.getTime();
  }

  defaultMessage() {
    return "Warranty expiry must be on or after purchase date";
  }
}

@ValidatorConstraint({ name: "nextServiceAfterLastService", async: false })
export class NextServiceAfterLastServiceConstraint implements ValidatorConstraintInterface {
  validate(nextServiceDate: string | undefined, args: ValidationArguments) {
    const lastServiceDate = parseOptionalDate((args.object as { lastServiceDate?: string }).lastServiceDate);
    const nextService = parseOptionalDate(nextServiceDate);
    if (!lastServiceDate || !nextService) {
      return true;
    }
    return nextService.getTime() >= lastServiceDate.getTime();
  }

  defaultMessage() {
    return "Next service date must be on or after last service date";
  }
}
