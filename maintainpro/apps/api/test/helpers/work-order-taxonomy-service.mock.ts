export function createWorkOrderTaxonomyServiceMock() {
  return {
    resolveTaxonomySelection: jest.fn().mockResolvedValue({
      taxonomyCategoryId: "taxonomy-category-id",
      taxonomyTypeId: "taxonomy-type-id",
      taxonomyIssueId: undefined,
      categoryNameSnapshot: "Fleet / Vehicle",
      typeNameSnapshot: "Brake Repair",
      issueNameSnapshot: undefined,
      isTriage: false,
      rules: {}
    }),
    suggest: jest.fn(),
    search: jest.fn(),
    list: jest.fn(),
    ensureSeed: jest.fn().mockResolvedValue(undefined)
  };
}
