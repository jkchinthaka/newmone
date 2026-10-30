/** Tag prefix per old fixed category: AST-MCH0001 for a machine, AST-EQP0001 for equipment. */
export function assetTagTypeCode(category?: string | null): string {
  const codes: Record<string, string> = {
    MACHINE: "MCH",
    EQUIPMENT: "EQP",
    TOOL: "TOL",
    INFRASTRUCTURE: "BLD",
    VEHICLE: "VEH",
    OTHER: "OTH"
  };
  const key = String(category ?? "").trim().toUpperCase();
  if (codes[key]) return codes[key];
  const letters = key.replace(/[^A-Z]/g, "").slice(0, 3);
  return letters.length === 3 ? letters : "AST";
}
