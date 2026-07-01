import { Priority, WorkOrderTaxonomyLevel } from "@prisma/client";

export type TaxonomySuggestCandidate = {
  id: string;
  code: string;
  name: string;
  level: WorkOrderTaxonomyLevel;
  parentId?: string | null;
  categoryName?: string;
  typeName?: string;
  issueName?: string;
  defaultPriority?: Priority | null;
  requiresAsset?: boolean;
  requiresVehicle?: boolean;
  requiresLocation?: boolean;
  requiresEvidence?: boolean;
  gateOutBlockingRisk?: boolean;
  aliases?: string[];
  keywords?: string[];
  sinhalaKeywords?: string[];
};

export type TaxonomySuggestion = {
  categoryId?: string;
  typeId?: string;
  issueId?: string;
  categoryName?: string;
  typeName?: string;
  issueName?: string;
  pathLabel: string;
  confidence: number;
  matchedKeywords: string[];
  defaultPriority?: Priority;
  requiresAsset: boolean;
  requiresVehicle: boolean;
  requiresLocation: boolean;
  requiresEvidence: boolean;
  gateOutBlockingRisk: boolean;
  warnings: string[];
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[\s,/+-]+/)
    .filter((token) => token.length >= 2);
}

function scoreCandidate(query: string, tokens: string[], candidate: TaxonomySuggestCandidate): { score: number; matched: string[] } {
  const haystacks = [
    candidate.name,
    candidate.categoryName,
    candidate.typeName,
    candidate.issueName,
    ...(candidate.aliases ?? []),
    ...(candidate.keywords ?? []),
    ...(candidate.sinhalaKeywords ?? [])
  ]
    .filter(Boolean)
    .map((value) => normalizeText(String(value)));

  const normalizedQuery = normalizeText(query);
  let score = 0;
  const matched = new Set<string>();

  if (normalizedQuery && haystacks.some((h) => h.includes(normalizedQuery))) {
    score += 40;
    matched.add(normalizedQuery);
  }

  for (const token of tokens) {
    for (const hay of haystacks) {
      if (hay === token || hay.includes(token) || token.includes(hay)) {
        score += token.length >= 4 ? 12 : 8;
        matched.add(token);
      }
    }
  }

  if (candidate.level === WorkOrderTaxonomyLevel.ISSUE) score += 5;
  if (candidate.level === WorkOrderTaxonomyLevel.TYPE) score += 2;

  return { score, matched: [...matched] };
}

export function suggestWorkOrderTaxonomy(
  query: string,
  rows: TaxonomySuggestCandidate[]
): TaxonomySuggestion | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  const issues = rows.filter((row) => row.level === WorkOrderTaxonomyLevel.ISSUE);
  const types = rows.filter((row) => row.level === WorkOrderTaxonomyLevel.TYPE);
  const categories = rows.filter((row) => row.level === WorkOrderTaxonomyLevel.CATEGORY);

  const ranked = [...issues, ...types, ...categories]
    .map((candidate) => ({ candidate, ...scoreCandidate(trimmed, tokens, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 8) return null;

  const issue = best.candidate.level === WorkOrderTaxonomyLevel.ISSUE ? best.candidate : undefined;
  const type =
    best.candidate.level === WorkOrderTaxonomyLevel.TYPE
      ? best.candidate
      : issue
        ? rows.find((row) => row.id === issue.parentId && row.level === WorkOrderTaxonomyLevel.TYPE)
        : undefined;
  const category =
    best.candidate.level === WorkOrderTaxonomyLevel.CATEGORY
      ? best.candidate
      : type
        ? rows.find((row) => row.id === type.parentId && row.level === WorkOrderTaxonomyLevel.CATEGORY)
        : issue?.parentId
          ? rows.find((row) => {
              const parentType = rows.find((r) => r.id === issue.parentId);
              return parentType ? row.id === parentType.parentId : false;
            })
          : undefined;

  const categoryName = category?.name ?? best.candidate.categoryName;
  const typeName = type?.name ?? (best.candidate.level === WorkOrderTaxonomyLevel.TYPE ? best.candidate.name : best.candidate.typeName);
  const issueName = issue?.name ?? (best.candidate.level === WorkOrderTaxonomyLevel.ISSUE ? best.candidate.name : undefined);

  const pathParts = [categoryName, typeName, issueName].filter(Boolean);
  const selected = issue ?? type ?? best.candidate;
  const confidence = Math.min(100, Math.round((best.score / 60) * 100));

  const warnings: string[] = [];
  if (selected.gateOutBlockingRisk) warnings.push("Gate-out block risk");
  if (selected.requiresVehicle && !selected.requiresAsset) warnings.push("Vehicle required");
  if (selected.requiresEvidence) warnings.push("Evidence required");

  return {
    categoryId: category?.id,
    typeId: type?.id ?? (best.candidate.level === WorkOrderTaxonomyLevel.TYPE ? best.candidate.id : undefined),
    issueId: issue?.id,
    categoryName,
    typeName,
    issueName,
    pathLabel: pathParts.join(" → "),
    confidence,
    matchedKeywords: best.matched,
    defaultPriority: selected.defaultPriority ?? undefined,
    requiresAsset: Boolean(selected.requiresAsset),
    requiresVehicle: Boolean(selected.requiresVehicle),
    requiresLocation: Boolean(selected.requiresLocation),
    requiresEvidence: Boolean(selected.requiresEvidence),
    gateOutBlockingRisk: Boolean(selected.gateOutBlockingRisk),
    warnings
  };
}

export function searchTaxonomyRows(query: string, rows: TaxonomySuggestCandidate[], limit = 25) {
  const tokens = tokenize(query);
  return rows
    .map((candidate) => ({ candidate, ...scoreCandidate(query, tokens, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => {
      const issue = entry.candidate.level === WorkOrderTaxonomyLevel.ISSUE ? entry.candidate : undefined;
      const type =
        entry.candidate.level === WorkOrderTaxonomyLevel.TYPE
          ? entry.candidate
          : issue
            ? rows.find((row) => row.id === issue.parentId)
            : undefined;
      const category =
        entry.candidate.level === WorkOrderTaxonomyLevel.CATEGORY
          ? entry.candidate
          : type
            ? rows.find((row) => row.id === type.parentId)
            : undefined;

      return {
        ...entry.candidate,
        categoryId: category?.id,
        typeId: type?.id ?? (entry.candidate.level === WorkOrderTaxonomyLevel.TYPE ? entry.candidate.id : undefined),
        issueId: issue?.id,
        score: entry.score,
        matchedKeywords: entry.matched,
        pathLabel: [
          category?.name ?? entry.candidate.categoryName,
          type?.name ?? entry.candidate.typeName,
          issue?.name ?? (entry.candidate.level === WorkOrderTaxonomyLevel.ISSUE ? entry.candidate.name : undefined)
        ]
          .filter(Boolean)
          .join(" → ")
      };
    });
}
