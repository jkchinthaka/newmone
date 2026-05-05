import {
  buildCanonicalDepartmentSeed,
  canonicalDepartmentName,
  MASTER_DEPARTMENT_NAMES,
  normalizeDepartmentName
} from "../src/modules/departments/department-master-list";

describe("department master list", () => {
  it("contains unique canonical department names and generated codes", () => {
    const seed = buildCanonicalDepartmentSeed();
    const normalizedNames = seed.map((department) => normalizeDepartmentName(department.name));
    const codes = seed.map((department) => department.code);

    expect(seed).toHaveLength(MASTER_DEPARTMENT_NAMES.length);
    expect(new Set(normalizedNames).size).toBe(seed.length);
    expect(new Set(codes).size).toBe(seed.length);
  });

  it("maps known legacy aliases to canonical departments", () => {
    expect(canonicalDepartmentName("IT Dept")).toBe("Information & Technology");
    expect(canonicalDepartmentName("QA")).toBe("Quality Assurance Department");
    expect(canonicalDepartmentName("R&D")).toBe("R & D");
  });
});
