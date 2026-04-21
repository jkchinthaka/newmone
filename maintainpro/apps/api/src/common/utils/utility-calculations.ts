export const calculateConsumption = (currentReading: number, previousReading: number): number => {
  if (currentReading < previousReading) {
    throw new Error("Current reading cannot be less than previous reading");
  }

  return currentReading - previousReading;
};

export const calculateBillTotal = (
  consumption: number,
  ratePerUnit: number,
  baseCharge = 0,
  taxAmount = 0
): number => {
  return consumption * ratePerUnit + baseCharge + taxAmount;
};
