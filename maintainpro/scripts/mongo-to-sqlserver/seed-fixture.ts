/**
 * Seed a disposable MongoDB with representative Phase 15A CMMS fixture data.
 * Uses BSON ObjectIds and scalar arrays to exercise transforms.
 */
import { createHash } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";

function oid(hex?: string): ObjectId {
  return hex ? new ObjectId(hex) : new ObjectId();
}

async function main() {
  const url = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
  const dbName = process.env.MONGO_DB_NAME || "MaintainProMigrateSource";
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);

  // Clean fixture collections we own
  const collections = [
    "Tenant",
    "Permission",
    "Role",
    "User",
    "Department",
    "Site",
    "FunctionalLocation",
    "AssetDomain",
    "AssetCategoryMaster",
    "AssetTypeMaster",
    "Asset",
    "Vehicle",
    "Supplier",
    "SparePart",
    "Warehouse",
    "MaintenanceRequest",
    "WorkOrder",
    "WorkOrderStatusHistory",
    "ApprovalRule",
    "ApprovalRequest",
    "ApprovalStep",
    "ApprovalDecision",
    "PmPlan",
    "AssetMeter",
    "WorkOrderCostSnapshot",
    "VendorContract",
    "AuditLog",
    "JobCode"
  ];
  for (const c of collections) {
    await db.collection(c).deleteMany({});
  }

  const tenantId = oid("aaaaaaaaaaaaaaaaaaaaaaaa");
  const permView = oid("bbbbbbbbbbbbbbbbbbbbbbb1");
  const permEdit = oid("bbbbbbbbbbbbbbbbbbbbbbb2");
  const roleAdmin = oid("ccccccccccccccccccccccc1");
  const roleTech = oid("ccccccccccccccccccccccc2");
  const userAdmin = oid("ddddddddddddddddddddddd1");
  const userTech = oid("ddddddddddddddddddddddd2");
  const deptId = oid("eeeeeeeeeeeeeeeeeeeeeee1");
  const siteId = oid("ffffffffffffffffffffff01");
  const flId = oid("111111111111111111111101");
  const domainId = oid("222222222222222222222201");
  const catId = oid("333333333333333333333301");
  const typeId = oid("444444444444444444444401");
  const assetId = oid("555555555555555555555501");
  const vehicleId = oid("666666666666666666666601");
  const supplierId = oid("777777777777777777777701");
  const partId = oid("888888888888888888888801");
  const whId = oid("999999999999999999999901");
  const reqId = oid("ababababababababababab01");
  const woId = oid("cdcdecdcdecdcdecdcdecd01");
  const ruleId = oid("efefefefefefefefefefef01");
  const apprReqId = oid("a1a1a1a1a1a1a1a1a1a1a101");
  const stepId = oid("b2b2b2b2b2b2b2b2b2b2b201");
  const pmId = oid("c3c3c3c3c3c3c3c3c3c3c301");
  const meterId = oid("d4d4d4d4d4d4d4d4d4d4d401");
  const snapId = oid("e5e5e5e5e5e5e5e5e5e5e501");
  const contractId = oid("f6f6f6f6f6f6f6f6f6f6f601");
  const jobCodeId = oid("121212121212121212121201");
  const now = new Date("2026-09-01T12:00:00.000Z");

  await db.collection("Tenant").insertOne({
    _id: tenantId,
    name: "Phase15A Fixture Tenant",
    slug: "phase15a-fixture",
    isActive: true,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("Permission").insertMany([
    { _id: permView, key: "work-orders.read", description: "Read WO", roleIds: [roleAdmin, roleTech], createdAt: now, updatedAt: now },
    { _id: permEdit, key: "work-orders.write", description: "Write WO", roleIds: [roleAdmin], createdAt: now, updatedAt: now }
  ]);

  await db.collection("Role").insertMany([
    {
      _id: roleAdmin,
      tenantId,
      name: "ADMIN",
      permissionIds: [permView, permEdit],
      createdAt: now,
      updatedAt: now
    },
    {
      _id: roleTech,
      tenantId,
      name: "TECHNICIAN",
      permissionIds: [permView],
      createdAt: now,
      updatedAt: now
    }
  ]);

  await db.collection("Department").insertOne({
    _id: deptId,
    tenantId,
    name: "Maintenance",
    code: "MAINT",
    createdAt: now,
    updatedAt: now
  });

  const passwordHash = createHash("sha256").update("not-a-real-password").digest("hex");
  await db.collection("User").insertMany([
    {
      _id: userAdmin,
      tenantId,
      email: "admin@phase15a.local",
      passwordHash,
      firstName: "Ada",
      lastName: "Admin",
      roleId: roleAdmin,
      departmentId: deptId,
      skills: ["Planning", "Electrical"],
      dailyCapacityHours: 8,
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      _id: userTech,
      tenantId,
      email: "tech@phase15a.local",
      passwordHash,
      firstName: "Ty",
      lastName: "Tech",
      roleId: roleTech,
      departmentId: deptId,
      skills: ["Mechanical"],
      dailyCapacityHours: 8,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  ]);

  await db.collection("Site").insertOne({
    _id: siteId,
    tenantId,
    code: "SITE-01",
    name: "Main Plant",
    type: "PLANT",
    createdAt: now,
    updatedAt: now
  });

  await db.collection("FunctionalLocation").insertOne({
    _id: flId,
    tenantId,
    siteId,
    code: "FL-LINE-1",
    name: "Line 1",
    type: "PRODUCTION_LINE",
    createdAt: now,
    updatedAt: now
  });

  await db.collection("AssetDomain").insertOne({
    _id: domainId,
    tenantId,
    code: "MECHANICAL",
    name: "Mechanical",
    profile: { downtimeCritical: true },
    createdAt: now,
    updatedAt: now
  });

  await db.collection("AssetCategoryMaster").insertOne({
    _id: catId,
    tenantId,
    domainId,
    code: "PUMP",
    name: "Pumps",
    createdAt: now,
    updatedAt: now
  });

  await db.collection("AssetTypeMaster").insertOne({
    _id: typeId,
    tenantId,
    categoryId: catId,
    code: "CENTRIFUGAL",
    name: "Centrifugal Pump",
    createdAt: now,
    updatedAt: now
  });

  await db.collection("Asset").insertOne({
    _id: assetId,
    tenantId,
    assetTag: "AST-100",
    name: "Pump A",
    category: "PUMP",
    status: "ACTIVE",
    condition: "GOOD",
    domainId,
    categoryMasterId: catId,
    typeMasterId: typeId,
    siteId,
    functionalLocationId: flId,
    images: ["https://example.com/a.jpg"],
    documents: [],
    customAttributes: { seal: "mech" },
    purchasePrice: 12500.5,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("Vehicle").insertOne({
    _id: vehicleId,
    tenantId,
    registrationNo: "WP-CAE-1234",
    make: "Toyota",
    vehicleModel: "HiAce",
    year: 2022,
    type: "VAN",
    fuelType: "DIESEL",
    ownershipType: "OWNED",
    status: "ACTIVE",
    serviceStatus: "IN_SERVICE",
    complianceStatus: "COMPLIANT",
    assetId,
    images: [],
    customFields: {},
    createdAt: now,
    updatedAt: now
  });

  await db.collection("Supplier").insertOne({
    _id: supplierId,
    tenantId,
    name: "Vendor Co",
    vendorCode: "VEND-1",
    serviceCategories: ["REPAIR", "PARTS"],
    createdAt: now,
    updatedAt: now
  });

  await db.collection("Warehouse").insertOne({
    _id: whId,
    tenantId,
    code: "WH-MAIN",
    name: "Main Store",
    createdAt: now,
    updatedAt: now
  });

  await db.collection("SparePart").insertOne({
    _id: partId,
    tenantId,
    partNumber: "BRG-6205",
    name: "Bearing 6205",
    category: "BEARINGS",
    unitCost: 10.5,
    quantityInStock: 20,
    images: [],
    createdAt: now,
    updatedAt: now
  });

  await db.collection("JobCode").insertOne({
    _id: jobCodeId,
    tenantId,
    code: "JC-PM",
    name: "PM Service",
    requiredSkills: ["Mechanical"],
    requiredPartIds: [partId],
    createdAt: now,
    updatedAt: now
  });

  await db.collection("MaintenanceRequest").insertOne({
    _id: reqId,
    tenantId,
    requestNumber: "MR-1001",
    status: "CONVERTED_TO_WO",
    description: "Bearing noise on pump A",
    priority: "HIGH",
    assetId,
    functionalLocationId: flId,
    reportedById: userAdmin,
    workOrderId: woId,
    reportedAt: now,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("WorkOrder").insertOne({
    _id: woId,
    tenantId,
    woNumber: "WO-1001",
    status: "CLOSED",
    priority: "HIGH",
    type: "CORRECTIVE",
    title: "Replace bearing",
    description: "Replace pump bearing",
    approvalStatus: "NOT_REQUIRED",
    verificationStatus: "VERIFIED",
    executionMode: "INTERNAL",
    qrVerificationStatus: "NOT_REQUIRED",
    assetId,
    functionalLocationId: flId,
    siteId,
    departmentId: deptId,
    domainId,
    createdById: userAdmin,
    technicianId: userTech,
    estimatedCost: 150.0,
    actualCost: 175.25,
    attachments: [],
    ppeRequired: ["Gloves"],
    maintenanceRequestId: reqId,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("WorkOrderStatusHistory").insertOne({
    _id: oid(),
    tenantId,
    workOrderId: woId,
    fromStatus: "OPEN",
    toStatus: "CLOSED",
    action: "CLOSE",
    actorId: userAdmin,
    metadata: { note: "done" },
    createdAt: now
  });

  await db.collection("ApprovalRule").insertOne({
    _id: ruleId,
    tenantId,
    name: "High cost",
    processType: "CRITICAL_WORK_ORDER",
    trigger: "WORK_ORDER_COST_THRESHOLD",
    ruleFamilyKey: "high-cost-wo",
    createdById: userAdmin,
    version: 1,
    isActive: true,
    amountThreshold: 1000,
    priorityScope: ["HIGH", "CRITICAL"],
    workTypeScope: ["CORRECTIVE"],
    conditions: [{ field: "estimatedCost", operator: "GTE", value: 1000 }],
    createdAt: now,
    updatedAt: now
  });

  await db.collection("ApprovalRequest").insertOne({
    _id: apprReqId,
    tenantId,
    triggeredRuleId: ruleId,
    triggeredRuleVersion: 1,
    status: "APPROVED",
    processType: "CRITICAL_WORK_ORDER",
    subjectEntityType: "WorkOrder",
    subjectEntityId: woId,
    requesterId: userAdmin,
    ruleSnapshot: { name: "High cost", version: 1, trigger: "WORK_ORDER_COST_THRESHOLD" },
    sourceContext: { wo: "WO-1001" },
    createdAt: now,
    updatedAt: now
  });

  await db.collection("ApprovalStep").insertOne({
    _id: stepId,
    tenantId,
    approvalRequestId: apprReqId,
    level: 1,
    status: "APPROVED",
    assignedApproverId: userAdmin,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("ApprovalDecision").insertOne({
    _id: oid(),
    tenantId,
    approvalRequestId: apprReqId,
    approvalStepId: stepId,
    decision: "APPROVED",
    actorId: userAdmin,
    decidedAt: now,
    createdAt: now
  });

  await db.collection("PmPlan").insertOne({
    _id: pmId,
    tenantId,
    code: "PM-PUMP-A",
    name: "Pump PM",
    status: "ACTIVE",
    priority: "MEDIUM",
    workType: "PREVENTIVE",
    assetId,
    requiredPartIds: [partId],
    createdAt: now,
    updatedAt: now
  });

  await db.collection("AssetMeter").insertOne({
    _id: meterId,
    tenantId,
    assetId,
    meterType: "RUNTIME_HOURS",
    name: "Runtime Hours",
    unit: "hours",
    currentValue: 1200,
    createdAt: now,
    updatedAt: now
  });

  await db.collection("WorkOrderCostSnapshot").insertOne({
    _id: snapId,
    tenantId,
    workOrderId: woId,
    partsCost: 10.5,
    internalLabourCost: 100,
    externalServiceCost: 50,
    transportCost: 0,
    otherCost: 14.75,
    totalCost: 175.25,
    currency: "LKR",
    lineItems: [{ partNumber: "BRG-6205", qty: 1, cost: 10.5 }],
    snappedAt: now
  });

  await db.collection("VendorContract").insertOne({
    _id: contractId,
    tenantId,
    supplierId,
    contractNo: "AMC-1",
    title: "Pump AMC 2026",
    contractType: "AMC",
    status: "ACTIVE",
    assetIds: [assetId],
    siteIds: [siteId],
    documentUrls: ["https://example.com/contract.pdf"],
    startDate: now,
    endDate: new Date("2027-09-01T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now
  });

  await db.collection("AuditLog").insertOne({
    _id: oid(),
    tenantId,
    entity: "WorkOrder",
    entityId: String(woId),
    action: "UPDATE",
    actorId: userAdmin,
    metadata: { event: "WO_CLOSED" },
    beforeData: { status: "COMPLETED" },
    afterData: { status: "CLOSED" },
    actorSnapshot: { email: "admin@phase15a.local" },
    createdAt: now
  });

  console.log(
    JSON.stringify(
      {
        db: dbName,
        tenantId: String(tenantId),
        users: 2,
        assets: 1,
        workOrders: 1,
        message: "Fixture seeded"
      },
      null,
      2
    )
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
