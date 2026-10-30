/**
 * Review & Submit for Report a Problem: every question asked in the earlier steps with the
 * answer given, grouped by step, so the person can check them before sending.
 */
export type ReportTargetKind = "MACHINE" | "VEHICLE" | "FACILITY" | "NOT_SURE";

export type ReportReviewInput = {
  targetKind: ReportTargetKind | null;
  machineLabel?: string | null;
  vehicleLabel?: string | null;
  siteName?: string | null;
  locationLabel?: string | null;
  approximateLocation?: string | null;
  description: string;
  reportedUrgency: string;
  safetyImpact: string;
  productionImpact: string;
};

export type ReportReviewItem = { question: string; answer: string; multiline?: boolean };
export type ReportReviewSection = { step: number; title: string; items: ReportReviewItem[] };

export const TARGET_KIND_LABELS: Record<ReportTargetKind, string> = {
  MACHINE: "Machine / Equipment",
  VEHICLE: "Vehicle",
  FACILITY: "Facility / Location",
  NOT_SURE: "Not Sure"
};

export const URGENCY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
  VERY_URGENT: "Very Urgent"
};

export const SAFETY_LABELS: Record<string, string> = { NO: "No", YES: "Yes", NOT_SURE: "Not Sure" };

export const PRODUCTION_LABELS: Record<string, string> = {
  NONE: "None",
  REDUCED: "Reduced / Partial",
  STOPPED: "Completely Stopped",
  NOT_SURE: "Not Sure"
};

const NOT_GIVEN = "Not given";
const answer = (value: string | null | undefined) => (value && value.trim() ? value.trim() : NOT_GIVEN);

export function reportReviewSections(input: ReportReviewInput): ReportReviewSection[] {
  const kind = input.targetKind;
  const where: ReportReviewItem[] = [];
  if (kind === "MACHINE") where.push({ question: "Which machine?", answer: answer(input.machineLabel) });
  if (kind === "VEHICLE") where.push({ question: "Which vehicle?", answer: answer(input.vehicleLabel) });
  if (kind === "FACILITY") {
    where.push({ question: "Site", answer: answer(input.siteName) });
    where.push({ question: "Functional location", answer: answer(input.locationLabel) });
  }
  if (kind === "NOT_SURE") {
    where.push({ question: "Site", answer: answer(input.siteName) });
    where.push({ question: "Approximate area", answer: answer(input.approximateLocation), multiline: true });
  }

  return [
    {
      step: 1,
      title: "What has a problem?",
      items: [{ question: "Type of problem", answer: kind ? TARGET_KIND_LABELS[kind] : NOT_GIVEN }]
    },
    { step: 2, title: kind === "NOT_SURE" ? "Where is the problem?" : "Which one?", items: where },
    {
      step: 3,
      title: "Describe the problem",
      items: [{ question: "What happened? What do you see or hear?", answer: answer(input.description), multiline: true }]
    },
    {
      step: 4,
      title: "Urgency and impact",
      items: [
        { question: "How urgent does this feel?", answer: URGENCY_LABELS[input.reportedUrgency] ?? answer(input.reportedUrgency) },
        { question: "Safety impact?", answer: SAFETY_LABELS[input.safetyImpact] ?? answer(input.safetyImpact) },
        {
          question: "Production / business impact?",
          answer: PRODUCTION_LABELS[input.productionImpact] ?? answer(input.productionImpact)
        }
      ]
    }
  ].filter((section) => section.items.length > 0);
}
