/**
 * Import the Nelna vehicle fleet (CSV) and the location/department list (xlsx)
 * into MongoDB Atlas via Prisma.
 *
 * Source files (committed under scripts/data/):
 *   - vehicle-information.csv   -> Vehicle model
 *   - locations.xlsx            -> Location collection (raw, via $runCommandRaw)
 *
 * Run from the maintainpro repo root:
 *   npm --prefix maintainpro/apps/api exec -- tsx scripts/import-vehicles.ts
 *
 * Or from apps/api:
 *   npx tsx scripts/import-vehicles.ts
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient, VehicleType, FuelType, VehicleStatus } from "@prisma/client";

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, "data", "vehicle-information.csv");

// Locations come straight from Book2.xlsx (sharedStrings.xml).
const LOCATIONS: string[] = [
  "Kandy Distribution Center",
  "Kottawa Distribution Center",
  "Negombo Distribution Center",
  "Hikkaduwa Distribution Center",
  "Embilipitiya Distribution Center",
  "Dambulla Distribution Center",
  "Rendering Plant (Breeder)",
  "Eheliyagoda Own Farm",
  "Further Processing Unit",
  "Feed Mixing Unit",
  "Wariyapola Own Farm",
  "Extension",
  "Farmer Supply Unit",
  "General Administration",
  "Maintenance",
  "Material Supply Unit",
  "Nelna Easy Unit",
  "Nelna Security Department",
  "NVRC",
  "Production",
  "Purchasing",
  "Finance",
  "Water Treatment Plant",
  "Nelna Impex",
  "Nelna Agri",
  "Nelna Breeder",
  "Sausages Plant",
  "Laundry Section",
  "Laboratory",
  "Katupotha",
  "Baddegama Land",
  "General Operation",
  "R & D",
  "Finished Good",
  "Human Resource Department",
  "Information & Technology",
  "Quality Assurance Department",
  "Sales & Marketing Department",
  "Grower Unit (Breeder)",
  "Layer Unit 01 (Breeder)",
  "Layer Unit 02 (Breeder)",
  "Hatchery (Breeder)",
  "Technical (Breeder)",
  "Operation (Breeder)",
  "Finance (Breeder)",
  "Maintenance (Breeder)",
  "Security (Breeder)",
  "Human Resource (Breeder)",
  "Narammala (Kovulwewa)",
  "Hathduwa Own Farm - Block1",
  "Hathduwa Own Farm - Block2"
];

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  // Light CSV parser: supports double-quoted fields and embedded commas/quotes.
  const lines: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\"") {
      inQuotes = !inQuotes;
      buf += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (buf.length) {
        lines.push(buf);
        buf = "";
      }
      // skip \r\n second char
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      buf += ch;
    }
  }
  if (buf.length) lines.push(buf);

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQ && line[i + 1] === "\"") {
          cur += "\"";
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const header = splitRow(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitRow(lines[r]);
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const row: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = (cells[c] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function s(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (!t || t === "0" || t.toUpperCase() === "NULL") return null;
  return t;
}

function strNullable(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function date(v: string | undefined): Date | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || t === "0") return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function mapVehicleType(group: string): VehicleType {
  const g = (group || "").toLowerCase();
  if (g.includes("bike") || g.includes("motor")) return VehicleType.MOTORCYCLE;
  if (g.includes("bus")) return VehicleType.BUS;
  if (g.includes("lorry") || g.includes("truck") || g.includes("tipper") || g.includes("prime mover"))
    return VehicleType.TRUCK;
  if (g.includes("van") || g.includes("cab")) return VehicleType.VAN;
  if (g.includes("car") || g.includes("jeep") || g.includes("suv")) return VehicleType.CAR;
  if (
    g.includes("tractor") ||
    g.includes("jcb") ||
    g.includes("generator") ||
    g.includes("fork") ||
    g.includes("bulldozer") ||
    g.includes("dozer") ||
    g.includes("road") ||
    g.includes("roller") ||
    g.includes("crow") ||
    g.includes("trailer") ||
    g.includes("tailer") ||
    g.includes("loader") ||
    g.includes("excavator") ||
    g.includes("land master") ||
    g.includes("equipment")
  )
    return VehicleType.HEAVY_EQUIPMENT;
  return VehicleType.OTHER;
}

function mapFuelType(fuel: string): FuelType {
  const f = (fuel || "").toLowerCase();
  if (f.includes("petrol") || f.includes("gasoline")) return FuelType.PETROL;
  if (f.includes("electric")) return FuelType.ELECTRIC;
  if (f.includes("hybrid")) return FuelType.HYBRID;
  if (f.includes("cng")) return FuelType.CNG;
  if (f.includes("lpg") || f.includes("gas")) return FuelType.LPG;
  return FuelType.DIESEL;
}

function mapStatus(st: string): VehicleStatus {
  const s2 = (st || "").toLowerCase();
  if (s2.includes("not")) return VehicleStatus.OUT_OF_SERVICE;
  if (s2.includes("dispos")) return VehicleStatus.DISPOSED;
  if (s2.includes("maint")) return VehicleStatus.UNDER_MAINTENANCE;
  if (s2.includes("use")) return VehicleStatus.IN_USE;
  return VehicleStatus.AVAILABLE;
}

async function importLocations(): Promise<void> {
  const docs = LOCATIONS.map((name) => ({
    name,
    source: "Book2.xlsx",
    importedAt: { $date: new Date().toISOString() }
  }));

  // Upsert one-by-one via raw command so we don't depend on a Prisma model.
  const updates = docs.map((d) => ({
    q: { name: d.name },
    u: { $set: d },
    upsert: true,
    multi: false
  }));

  const res: any = await prisma.$runCommandRaw({
    update: "Location",
    updates,
    ordered: false
  });

  const matched = res?.n ?? 0;
  const upserted = Array.isArray(res?.upserted) ? res.upserted.length : 0;
  console.log(
    `[locations] processed=${LOCATIONS.length} matched/updated=${matched} newlyInserted=${upserted}`
  );
}

async function importVehicles(): Promise<void> {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}`);
  }
  const text = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  console.log(`[vehicles] parsed ${rows.length} rows from CSV`);

  // Track unique VINs so we don't violate the unique constraint.
  const vinSeen = new Set<string>();
  const existingVins = await prisma.vehicle.findMany({ select: { vin: true } });
  for (const v of existingVins) if (v.vin) vinSeen.add(v.vin);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const reg = strNullable(row["VehicleNo"]);
    if (!reg) {
      skipped++;
      continue;
    }

    const purchase = date(row["PurchaseDate"]);
    const year = purchase ? purchase.getFullYear() : new Date().getFullYear();

    let vin: string | null = strNullable(row["ChasisNumber"]);
    if (vin && vinSeen.has(vin)) vin = null;
    if (vin) vinSeen.add(vin);

    const make = strNullable(row["VehicleMake"]) ?? "Unknown";
    const vehicleModelName =
      strNullable(row["VehicleModelCode"]) ??
      strNullable(row["VehicleType"]) ??
      strNullable(row["VehicleDescription"]) ??
      "Unknown";

    const data = {
      registrationNo: reg,
      make,
      vehicleModel: vehicleModelName,
      description: strNullable(row["VehicleDescription"]),
      location: strNullable(row["Location"]),
      year,
      type: mapVehicleType(row["VehicleGroup"] ?? row["VehicleType"] ?? ""),
      status: mapStatus(row["Status"] ?? ""),
      color: strNullable(row["VehicleColor"]),
      vin,
      engineNo: strNullable(row["EngineNumber"]),
      fuelType: mapFuelType(row["VehicleFuelType"] ?? ""),
      fuelCapacity: num(row["TankCapacity"]),
      currentMileage: num(row["CurrentMileage"]) ?? 0,
      lastServiceDate: date(row["LastServiceDate"]),
      nextServiceDate: date(row["NextServiceDate"]),
      nextServiceMileage: num(row["NextServiceMileage"])
    };

    try {
      const existing = await prisma.vehicle.findUnique({
        where: { registrationNo: reg },
        select: { id: true }
      });
      if (existing) {
        await prisma.vehicle.update({ where: { registrationNo: reg }, data });
        updated++;
      } else {
        await prisma.vehicle.create({ data });
        created++;
      }
    } catch (err: any) {
      skipped++;
      console.warn(`[vehicles] failed reg=${reg}: ${err.message}`);
    }
  }

  console.log(
    `[vehicles] done created=${created} updated=${updated} skipped=${skipped} total=${rows.length}`
  );
}

async function main(): Promise<void> {
  console.log(
    `[import] target DB = ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown)"}`
  );
  await importLocations();
  await importVehicles();
}

main()
  .catch((e) => {
    console.error("[import] FAILED", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
