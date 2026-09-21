import {
  isJobDomain,
  parseJobDomain,
  resolveJobDomain,
  jobDomainLabel
} from "../src/common/utils/job-domain.util";

describe("job-domain.util", () => {
  it("parses and labels domains", () => {
    expect(isJobDomain("MACHINERY")).toBe(true);
    expect(parseJobDomain("vehicle")).toBe("VEHICLE");
    expect(jobDomainLabel("SERVICE")).toBe("Service");
  });

  it("prefers explicit jobDomain", () => {
    expect(
      resolveJobDomain({
        jobDomain: "SERVICE",
        vehicleId: "v1",
        assetId: "a1",
        assetDomainCode: "FLEET"
      })
    ).toBe("SERVICE");
  });

  it("infers VEHICLE from vehicleId or FLEET domain", () => {
    expect(resolveJobDomain({ vehicleId: "v1" })).toBe("VEHICLE");
    expect(resolveJobDomain({ assetId: "a1", assetDomainCode: "FLEET" })).toBe("VEHICLE");
  });

  it("infers MACHINERY from plant domains", () => {
    expect(resolveJobDomain({ assetId: "a1", assetDomainCode: "PLANT_MACHINERY" })).toBe(
      "MACHINERY"
    );
    expect(resolveJobDomain({ assetId: "a1" })).toBe("MACHINERY");
  });

  it("infers SERVICE for location-only or facility domains", () => {
    expect(resolveJobDomain({})).toBe("SERVICE");
    expect(resolveJobDomain({ assetId: "a1", assetDomainCode: "FACILITY_CIVIL" })).toBe("SERVICE");
  });

  it("keeps explicit MACHINERY when create has no asset/vehicle (HCI domain lane)", () => {
    // Without explicit jobDomain, empty payload would become SERVICE — domain pages must stamp.
    expect(resolveJobDomain({})).toBe("SERVICE");
    expect(
      resolveJobDomain({
        jobDomain: "MACHINERY",
        assetId: null,
        vehicleId: null
      })
    ).toBe("MACHINERY");
  });
});
