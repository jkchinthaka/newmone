export type InspectionChecklistItem = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  signatureJustified?: boolean;
  metadata?: { critical?: boolean; photoOnFail?: boolean; commentOnFail?: boolean } | null;
};

export type InspectionAnswer = {
  value?: string | number | boolean | null;
  comment?: string | null;
  evidenceRefs?: string[];
};

export type DerivedFinding = {
  itemKey: string;
  severity: string;
  description: string;
  evidenceUrls: string[];
};

export function evaluateInspectionChecklist(input: {
  items: InspectionChecklistItem[];
  answers: Record<string, InspectionAnswer>;
}): { result: "PASS" | "OBSERVATION" | "FAIL"; errors: string[]; findings: DerivedFinding[] } {
  const errors: string[] = [];
  const findings: DerivedFinding[] = [];
  let criticalFail = false;
  let minorFinding = false;

  for (const item of input.items) {
    const answer = input.answers[item.key] ?? {};
    const raw = answer.value;
    const text = raw == null ? "" : String(raw).trim();
    const failed =
      text.toUpperCase() === "FAIL" ||
      text.toUpperCase() === "NO" ||
      raw === false;

    if (item.required && text.length === 0) {
      errors.push(`${item.label} is required.`);
    }

    if (item.type === "NUMERIC" && text.length > 0) {
      const numeric = Number(text);
      if (!Number.isFinite(numeric)) {
        errors.push(`${item.label} must be a number.`);
      } else if (
        (item.minValue != null && numeric < item.minValue) ||
        (item.maxValue != null && numeric > item.maxValue)
      ) {
        minorFinding = true;
        findings.push({
          itemKey: item.key,
          severity: item.metadata?.critical ? "CRITICAL" : "MEDIUM",
          description: `${item.label} is outside ${item.minValue ?? "—"}–${item.maxValue ?? "—"}${item.unit ? ` ${item.unit}` : ""}.`,
          evidenceUrls: answer.evidenceRefs ?? []
        });
        if (item.metadata?.critical) criticalFail = true;
      }
    }

    if (failed) {
      if (item.metadata?.critical) criticalFail = true;
      else minorFinding = true;
      if (item.metadata?.commentOnFail && !answer.comment?.trim()) {
        errors.push(`${item.label} requires a comment when it fails.`);
      }
      if (item.metadata?.photoOnFail && !(answer.evidenceRefs?.length)) {
        errors.push(`${item.label} requires evidence when it fails.`);
      }
      findings.push({
        itemKey: item.key,
        severity: item.metadata?.critical ? "CRITICAL" : "LOW",
        description: answer.comment?.trim() || `${item.label} failed.`,
        evidenceUrls: answer.evidenceRefs ?? []
      });
    }

    if (item.signatureJustified && !text) {
      errors.push(`${item.label} requires a signature.`);
    }
  }

  const result = criticalFail ? "FAIL" : minorFinding || findings.length ? "OBSERVATION" : "PASS";
  return { result, errors, findings };
}
