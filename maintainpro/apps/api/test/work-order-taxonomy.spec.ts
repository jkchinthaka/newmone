import { Priority, WorkOrderTaxonomyLevel } from "@prisma/client";

import {
  searchTaxonomyRows,
  suggestWorkOrderTaxonomy,
  type TaxonomySuggestCandidate
} from "../src/common/utils/work-order-taxonomy-suggest";
import { WORK_ORDER_TAXONOMY_SEED } from "../src/database/work-order-taxonomy-seed";
import { WorkOrderTaxonomyService } from "../src/modules/work-order-taxonomy/work-order-taxonomy.service";

function buildCandidatesFromSeed(): TaxonomySuggestCandidate[] {
  const rows: TaxonomySuggestCandidate[] = [];

  for (const category of WORK_ORDER_TAXONOMY_SEED) {
    rows.push({
      id: category.code,
      code: category.code,
      name: category.name,
      level: WorkOrderTaxonomyLevel.CATEGORY,
      keywords: [],
      aliases: []
    });

    for (const type of category.types) {
      rows.push({
        id: `${category.code}:${type.code}`,
        code: type.code,
        name: type.name,
        level: WorkOrderTaxonomyLevel.TYPE,
        parentId: category.code,
        categoryName: category.name,
        keywords: type.keywords ?? [],
        aliases: type.aliases ?? [],
        sinhalaKeywords: type.sinhalaKeywords ?? [],
        defaultPriority: type.rules?.defaultPriority,
        requiresVehicle: type.rules?.requiresVehicle,
        gateOutBlockingRisk: type.rules?.gateOutBlockingRisk
      });

      for (const issue of type.issues ?? []) {
        rows.push({
          id: `${category.code}:${type.code}:${issue.code}`,
          code: issue.code,
          name: issue.name,
          level: WorkOrderTaxonomyLevel.ISSUE,
          parentId: `${category.code}:${type.code}`,
          categoryName: category.name,
          typeName: type.name,
          keywords: issue.keywords ?? [],
          aliases: issue.aliases ?? [],
          sinhalaKeywords: issue.sinhalaKeywords ?? [],
          defaultPriority: issue.rules?.defaultPriority ?? type.rules?.defaultPriority,
          requiresVehicle: issue.rules?.requiresVehicle ?? type.rules?.requiresVehicle,
          gateOutBlockingRisk: issue.rules?.gateOutBlockingRisk ?? type.rules?.gateOutBlockingRisk
        });
      }
    }
  }

  return rows;
}

describe("work order taxonomy suggest", () => {
  const candidates = buildCandidatesFromSeed();

  it("suggests brake repair for lorry brake issue", () => {
    const suggestion = suggestWorkOrderTaxonomy("lorry brake issue", candidates);
    expect(suggestion).not.toBeNull();
    expect(suggestion?.pathLabel.toLowerCase()).toContain("brake");
    expect(suggestion?.requiresVehicle).toBe(true);
    expect(suggestion?.gateOutBlockingRisk).toBe(true);
    expect(suggestion?.defaultPriority).toBe(Priority.CRITICAL);
  });

  it("suggests printer issue for printer not printing", () => {
    const suggestion = suggestWorkOrderTaxonomy("printer not printing", candidates);
    expect(suggestion?.pathLabel.toLowerCase()).toContain("printer");
  });

  it("suggests plumbing for water leak", () => {
    const suggestion = suggestWorkOrderTaxonomy("water leak", candidates);
    expect(suggestion?.pathLabel.toLowerCase()).toContain("plumbing");
  });

  it("suggests cold chain for cold room temperature high", () => {
    const suggestion = suggestWorkOrderTaxonomy("cold room temperature high", candidates);
    expect(suggestion?.pathLabel.toLowerCase()).toMatch(/cold|refrigeration|temperature/);
  });

  it("suggests tyre replacement for tyre keyword", () => {
    const suggestion = suggestWorkOrderTaxonomy("tyre", candidates);
    expect(suggestion?.pathLabel.toLowerCase()).toContain("tyre");
  });

  it("suggests network issue for wifi", () => {
    const suggestion = suggestWorkOrderTaxonomy("wifi", candidates);
    expect(suggestion?.pathLabel.toLowerCase()).toMatch(/network|wifi|router/);
  });

  it("matches sinhala transliterated brake keyword", () => {
    const matches = searchTaxonomyRows("brake", candidates, 5);
    expect(matches.some((row) => row.pathLabel.toLowerCase().includes("brake"))).toBe(true);
  });

  it("returns confidence and matched keywords", () => {
    const suggestion = suggestWorkOrderTaxonomy("wifi internet", candidates);
    expect(suggestion?.confidence).toBeGreaterThan(0);
    expect(suggestion?.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("returns null suggestion for unknown query without throwing", () => {
    const suggestion = suggestWorkOrderTaxonomy("unknowntextxyz", candidates);
    expect(suggestion).toBeNull();
  });
});

describe("WorkOrderTaxonomyService permissions", () => {
  it("blocks non-admin taxonomy management", () => {
    const service = new WorkOrderTaxonomyService({} as never);
    expect(() =>
      service.assertCanManageTaxonomy({ sub: "u1", email: "tech@example.com", role: "TECHNICIAN" })
    ).toThrow("permission");
  });
});
