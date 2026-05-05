export const MASTER_DEPARTMENT_NAMES = [
  "Eheliyagoda Own Farm",
  "Further Processing Unit",
  "Feed Mixing Unit",
  "Wariyapola Own Farm",
  "Extension",
  "Finished Good",
  "Farmer Supply Unit",
  "General Administration",
  "Human Resource Department",
  "Information & Technology",
  "Maintenance",
  "Material Supply Unit",
  "Nelna Easy Unit",
  "Nelna Security Department",
  "NVRC",
  "Production",
  "Purchasing",
  "Quality Assurance Department",
  "Kandy Distribution Center",
  "Kottawa Distribution Center",
  "Negombo Distribution Center",
  "Hikkaduwa Distribution Center",
  "Embilipitiya Distribution Center",
  "Dambulla Distribution Center",
  "Sales & Marketing Department",
  "Finance",
  "Water Treatment Plant",
  "Nelna Impex",
  "Nelna Agri",
  "Grower Unit (Breeder)",
  "Layer Unit 01 (Breeder)",
  "Layer Unit 02 (Breeder)",
  "Hatchery (Breeder)",
  "Rendering Plant (Breeder)",
  "Technical (Breeder)",
  "Operation (Breeder)",
  "Human Resource (Breeder)",
  "Finance (Breeder)",
  "Maintenance (Breeder)",
  "Security (Breeder)",
  "Nelna Breeder",
  "Sausages Plant",
  "Laundry Section",
  "Laboratory",
  "Katupotha",
  "Narammala (Kovulwewa)",
  "Baddegama Land",
  "General Operation",
  "R & D",
  "Hathduwa Own Farm - Block1",
  "Hathduwa Own Farm - Block2"
] as const;

export const LEGACY_DEPARTMENT_ALIASES: Record<string, string> = {
  "administration": "General Administration",
  "facilities": "General Administration",
  "hr": "Human Resource Department",
  "human resources": "Human Resource Department",
  "human resource": "Human Resource Department",
  "it": "Information & Technology",
  "it dept": "Information & Technology",
  "it department": "Information & Technology",
  "information technology": "Information & Technology",
  "maintenance dept": "Maintenance",
  "qa": "Quality Assurance Department",
  "quality assurance": "Quality Assurance Department",
  "r&d": "R & D",
  "research and development": "R & D",
  "sales marketing": "Sales & Marketing Department",
  "transport": "General Operation",
  "workshop": "Maintenance"
};

export function normalizeDepartmentName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalDepartmentName(value: string) {
  const normalized = normalizeDepartmentName(value);
  const directMatch = MASTER_DEPARTMENT_NAMES.find((name) => normalizeDepartmentName(name) === normalized);
  if (directMatch) return directMatch;
  const aliasMatch = Object.entries(LEGACY_DEPARTMENT_ALIASES).find(([alias]) => normalizeDepartmentName(alias) === normalized);
  return aliasMatch?.[1] ?? null;
}

export function createDepartmentCode(name: string, usedCodes: Set<string> = new Set()) {
  const words = name
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const acronym = words.map((word) => word[0]).join("").toUpperCase();
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const base = (acronym.length >= 3 ? acronym : compact.slice(0, 10) || "DEPT").slice(0, 12);
  let code = base;
  let suffix = 2;

  while (usedCodes.has(code)) {
    const suffixText = String(suffix);
    code = `${base.slice(0, Math.max(1, 12 - suffixText.length - 1))}-${suffixText}`;
    suffix += 1;
  }

  return code;
}

export function buildCanonicalDepartmentSeed() {
  const usedNames = new Set<string>();
  const usedCodes = new Set<string>();

  return MASTER_DEPARTMENT_NAMES.map((name) => name.trim())
    .filter((name) => {
      const normalized = normalizeDepartmentName(name);
      if (usedNames.has(normalized)) return false;
      usedNames.add(normalized);
      return true;
    })
    .map((name) => {
      const code = createDepartmentCode(name, usedCodes);
      usedCodes.add(code);
      return { name, code };
    });
}
