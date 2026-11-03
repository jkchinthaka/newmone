/**
 * Extended, real-world machine / vehicle / equipment types.
 * Additive only: seedDefaults() skips anything that already exists, so this can be
 * re-run safely on a live tenant (POST /asset-taxonomy/seed-defaults). No schema change.
 * Categories that already exist (same domain + code) only receive the missing types.
 */
export type CategoryExample = {
  domainCode: string;
  code: string;
  name: string;
  legacyEnum?: string;
  types?: Array<{ code: string; name: string }>;
};

type T = [string, string];

function cat(domainCode: string, code: string, name: string, legacyEnum: string | undefined, types: T[]): CategoryExample {
  return {
    domainCode,
    code,
    name,
    ...(legacyEnum ? { legacyEnum } : {}),
    types: types.map(([c, n]) => ({ code: c, name: n }))
  };
}

export const EXTENDED_CATEGORY_EXAMPLES: CategoryExample[] = [
  // ── Plant & machinery (food processing, packing, workshop) ───────────────
  cat("PLANT_MACHINERY", "MACHINE", "Machine", "MACHINE", [
    ["CONVEYOR", "Conveyor"], ["PACKING_MACHINE", "Packing Machine"], ["FILLING_MACHINE", "Filling Machine"],
    ["SEALING_MACHINE", "Sealing Machine"], ["LABELLING_MACHINE", "Labelling Machine"], ["VACUUM_PACKER", "Vacuum Packer"],
    ["SHRINK_WRAP_MACHINE", "Shrink Wrap Machine"], ["CODING_PRINTER", "Coding / Date Printer"], ["METAL_DETECTOR", "Metal Detector"],
    ["CHECK_WEIGHER", "Check Weigher"], ["SORTING_GRADING_MACHINE", "Sorting / Grading Machine"], ["FRUIT_WASHER", "Fruit / Vegetable Washer"],
    ["PEELING_MACHINE", "Peeling Machine"], ["CUTTING_SLICING_MACHINE", "Cutting / Slicing Machine"], ["PULPER", "Pulper"],
    ["MIXER_BLENDER", "Mixer / Blender"], ["HOMOGENIZER", "Homogenizer"], ["PASTEURIZER", "Pasteurizer"],
    ["STERILIZER_RETORT", "Sterilizer / Retort"], ["EVAPORATOR", "Evaporator"], ["DRYER_DEHYDRATOR", "Dryer / Dehydrator"],
    ["OVEN", "Oven"], ["FRYER", "Industrial Fryer"], ["EXTRUDER", "Extruder"], ["GRINDER_MILL", "Grinder / Mill"],
    ["CENTRIFUGE_SEPARATOR", "Centrifuge / Separator"], ["FILTER_PRESS", "Filter Press"], ["JUICE_EXTRACTOR", "Juice Extractor"],
    ["LATHE", "Lathe"], ["MILLING_MACHINE", "Milling Machine"], ["DRILL_PRESS", "Drill Press"], ["GRINDING_MACHINE", "Grinding Machine"],
    ["WELDING_MACHINE", "Welding Machine"], ["CUTTING_MACHINE", "Cutting / Plasma Machine"], ["HYDRAULIC_PRESS", "Hydraulic Press"],
    ["SAW", "Saw (Band / Circular)"], ["INDUSTRIAL_SEWING_MACHINE", "Industrial Sewing Machine"]
  ]),
  cat("MECHANICAL", "EQUIPMENT", "Equipment", "EQUIPMENT", [
    ["PRESSURE_WASHER", "Pressure Washer"], ["WELDING_SET", "Welding Set"], ["HYDRAULIC_JACK", "Hydraulic Jack"],
    ["CHAIN_BLOCK", "Chain Block / Hoist"], ["WEIGHBRIDGE", "Weighbridge"], ["PLATFORM_SCALE", "Platform Scale"],
    ["TROLLEY", "Trolley"], ["VACUUM_CLEANER_INDUSTRIAL", "Industrial Vacuum Cleaner"], ["FLOOR_SCRUBBER", "Floor Scrubber"],
    ["BLOWER", "Blower"], ["EXHAUST_FAN", "Exhaust Fan"], ["GEARBOX", "Gearbox"], ["ELECTRIC_MOTOR_MECH", "Motor (Mechanical Drive)"]
  ]),

  // ── Utilities ────────────────────────────────────────────────────────────
  cat("UTILITIES", "BOILER", "Boiler", undefined, [
    ["STEAM_BOILER", "Steam Boiler"], ["HOT_WATER_BOILER", "Hot Water Boiler"], ["THERMIC_OIL_HEATER", "Thermic Oil Heater"],
    ["BIOMASS_BOILER", "Biomass Boiler"]
  ]),
  cat("UTILITIES", "AIR_COMPRESSOR", "Air Compressor", undefined, [
    ["SCREW_COMPRESSOR", "Screw Compressor"], ["RECIPROCATING_COMPRESSOR", "Reciprocating Compressor"],
    ["AIR_DRYER", "Air Dryer"], ["AIR_RECEIVER", "Air Receiver Tank"]
  ]),
  cat("UTILITIES", "COOLING_TOWER", "Cooling Tower", undefined, [["COOLING_TOWER_UNIT", "Cooling Tower"]]),
  cat("UTILITIES", "STORAGE_TANK", "Storage Tank", undefined, [
    ["WATER_STORAGE_TANK", "Water Storage Tank"], ["FUEL_STORAGE_TANK", "Fuel Storage Tank"], ["LPG_TANK", "LPG Tank"],
    ["DIESEL_DAY_TANK", "Diesel Day Tank"]
  ]),
  cat("UTILITIES", "GENERATOR", "Generator", undefined, [
    ["PETROL_GENERATOR", "Petrol Generator"], ["PORTABLE_GENERATOR", "Portable Generator"], ["STANDBY_GENERATOR", "Standby Generator"],
    ["ATS_PANEL", "Auto Transfer Switch (ATS)"]
  ]),
  cat("UTILITIES", "PUMP", "Pump", undefined, [
    ["BOOSTER_PUMP", "Booster Pump"], ["TRANSFER_PUMP", "Transfer Pump"], ["DOSING_PUMP", "Dosing Pump"], ["VACUUM_PUMP", "Vacuum Pump"],
    ["GEAR_PUMP", "Gear / Positive Displacement Pump"], ["BOREHOLE_PUMP", "Borehole Pump"], ["SUMP_PUMP", "Sump Pump"]
  ]),

  // ── Electrical ───────────────────────────────────────────────────────────
  cat("ELECTRICAL", "TRANSFORMER", "Transformer", undefined, [
    ["DISTRIBUTION_TRANSFORMER", "Distribution Transformer"], ["DRY_TYPE_TRANSFORMER", "Dry Type Transformer"]
  ]),
  cat("ELECTRICAL", "ELECTRICAL_PANEL", "Electrical Panel", undefined, [
    ["MAIN_DISTRIBUTION_BOARD", "Main Distribution Board (MDB)"], ["DISTRIBUTION_BOARD", "Distribution Board (DB)"],
    ["MOTOR_CONTROL_CENTRE", "Motor Control Centre (MCC)"], ["CAPACITOR_BANK", "Capacitor Bank / PFC Panel"], ["CONTROL_PANEL", "Control Panel / PLC"]
  ]),
  cat("ELECTRICAL", "UPS", "UPS / Power Backup", undefined, [
    ["ONLINE_UPS", "Online UPS"], ["OFFLINE_UPS", "Offline UPS"], ["BATTERY_BANK", "Battery Bank"], ["STABILIZER", "Voltage Stabilizer"]
  ]),
  cat("ELECTRICAL", "ELECTRIC_MOTOR", "Electric Motor / Drive", undefined, [
    ["AC_MOTOR", "AC Motor"], ["VFD", "Variable Frequency Drive (VFD)"], ["SOFT_STARTER", "Soft Starter"]
  ]),
  cat("ELECTRICAL", "LIGHTING", "Lighting", undefined, [
    ["LED_LIGHT", "LED Light"], ["FLOOD_LIGHT", "Flood Light"], ["STREET_LIGHT", "Street Light"], ["EMERGENCY_LIGHT", "Emergency Light"]
  ]),

  // ── HVAC / refrigeration ─────────────────────────────────────────────────
  cat("HVAC", "AIR_CONDITIONER", "Air Conditioner", undefined, [
    ["SPLIT_AC", "Split AC"], ["CASSETTE_AC", "Cassette AC"], ["DUCTED_AC", "Ducted AC"], ["WINDOW_AC", "Window AC"],
    ["VRF_SYSTEM", "VRF System"], ["AIR_HANDLING_UNIT", "Air Handling Unit (AHU)"], ["CHILLER_PLANT", "Chiller Plant"]
  ]),
  cat("FACILITY_CIVIL", "AIR_CONDITIONER", "Air Conditioner", undefined, [
    ["CASSETTE_AC", "Cassette AC"], ["DUCTED_AC", "Ducted AC"], ["WINDOW_AC", "Window AC"], ["VRF_SYSTEM", "VRF System"]
  ]),
  cat("REFRIGERATION", "COLD_ROOM", "Cold Room", "COLD_ROOM", [
    ["CHILLER_ROOM", "Chiller Room"], ["FREEZER_ROOM", "Freezer Room"], ["BLAST_FREEZER", "Blast Freezer"],
    ["RIPENING_CHAMBER", "Ripening Chamber"], ["CONTROLLED_ATMOSPHERE_STORE", "Controlled Atmosphere Store"]
  ]),
  cat("REFRIGERATION", "REFRIGERATION_EQUIPMENT", "Refrigeration Equipment", undefined, [
    ["DISPLAY_CHILLER", "Display Chiller"], ["DEEP_FREEZER", "Deep Freezer"], ["CHEST_FREEZER", "Chest Freezer"],
    ["UPRIGHT_FREEZER", "Upright Freezer"], ["ICE_MACHINE", "Ice Machine"], ["WATER_COOLER", "Water Cooler / Dispenser"],
    ["REEFER_CONTAINER", "Reefer Container"], ["CONDENSING_UNIT", "Condensing Unit"], ["EVAPORATOR_UNIT", "Evaporator Unit"]
  ]),

  // ── Material handling ────────────────────────────────────────────────────
  cat("MATERIAL_HANDLING", "FORKLIFT", "Forklift", "EQUIPMENT", [
    ["ELECTRIC_FORKLIFT", "Electric Forklift"], ["DIESEL_FORKLIFT", "Diesel Forklift"], ["LPG_FORKLIFT", "LPG Forklift"],
    ["REACH_TRUCK", "Reach Truck"], ["ORDER_PICKER", "Order Picker"]
  ]),
  cat("MATERIAL_HANDLING", "PALLET_HANDLING", "Pallet / Stacker", "EQUIPMENT", [
    ["MANUAL_PALLET_JACK", "Manual Pallet Jack"], ["ELECTRIC_PALLET_JACK", "Electric Pallet Jack"], ["STACKER", "Stacker"],
    ["SCISSOR_LIFT", "Scissor Lift"], ["DOCK_LEVELER", "Dock Leveler"]
  ]),
  cat("MATERIAL_HANDLING", "CRANE_HOIST", "Crane / Hoist", "EQUIPMENT", [
    ["OVERHEAD_CRANE", "Overhead Crane"], ["JIB_CRANE", "Jib Crane"], ["ELECTRIC_HOIST", "Electric Hoist"], ["MOBILE_CRANE", "Mobile Crane"]
  ]),
  cat("MATERIAL_HANDLING", "LIFT_ELEVATOR", "Lift / Elevator", undefined, [
    ["PASSENGER_LIFT", "Passenger Lift"], ["GOODS_LIFT", "Goods Lift"], ["PLATFORM_LIFT", "Platform Lift"]
  ]),

  // ── Fleet (on-road vehicles + heavy equipment) ───────────────────────────
  cat("FLEET", "VEHICLE", "Vehicle", "VEHICLE", [
    ["CAR", "Car"], ["JEEP_SUV", "Jeep / SUV"], ["PICKUP_DOUBLE_CAB", "Pickup / Double Cab"], ["MOTORCYCLE", "Motorcycle"],
    ["THREE_WHEELER", "Three-Wheeler"], ["MINI_VAN", "Mini Van"], ["MINI_LORRY", "Mini Lorry (Light Truck)"], ["LORRY", "Lorry"],
    ["HEAVY_LORRY", "Heavy Lorry"], ["TIPPER", "Tipper"], ["PRIME_MOVER", "Prime Mover"], ["TRAILER", "Trailer"],
    ["WATER_BOWSER", "Water Bowser"], ["FUEL_BOWSER", "Fuel Bowser"], ["REFRIGERATED_TRUCK", "Refrigerated Truck (Reefer)"],
    ["INSULATED_TRUCK", "Insulated Truck"], ["MINI_BUS", "Mini Bus"], ["BUS", "Bus"], ["ELECTRIC_VEHICLE", "Electric Vehicle"],
    ["GOLF_CART", "Golf Cart / Utility Cart"]
  ]),
  cat("FLEET", "HEAVY_EQUIPMENT", "Heavy Equipment", "MACHINE", [
    ["BACKHOE_LOADER", "Backhoe Loader"], ["EXCAVATOR", "Excavator"], ["WHEEL_LOADER", "Wheel Loader"], ["BULLDOZER", "Bulldozer"],
    ["ROAD_ROLLER", "Road Roller"], ["MOTOR_GRADER", "Motor Grader"], ["SKID_STEER", "Skid Steer Loader"]
  ]),

  // ── Farm ─────────────────────────────────────────────────────────────────
  cat("FARM_INFRASTRUCTURE", "TRACTOR", "Tractor", "TRACTOR", [
    ["TRACTOR_2WD", "Tractor 2WD"], ["TRACTOR_4WD", "Tractor 4WD"], ["WALKING_TRACTOR", "Walking Tractor (Hand Tractor)"],
    ["ORCHARD_TRACTOR", "Orchard Tractor"]
  ]),
  cat("FARM_INFRASTRUCTURE", "FARM_IMPLEMENT", "Farm Implement", "EQUIPMENT", [
    ["PLOUGH", "Plough"], ["HARROW", "Harrow"], ["ROTAVATOR", "Rotavator"], ["FARM_TRAILER", "Farm Trailer"],
    ["GRASS_CUTTER", "Grass Cutter / Mower"], ["BRUSH_CUTTER", "Brush Cutter"], ["CHAINSAW", "Chainsaw"], ["SEEDER_PLANTER", "Seeder / Planter"]
  ]),
  cat("FARM_INFRASTRUCTURE", "HARVESTER", "Harvester", "HARVESTER", [
    ["COMBINE_HARVESTER", "Combine Harvester"], ["MINI_HARVESTER", "Mini Harvester"], ["FRUIT_PICKING_PLATFORM", "Fruit Picking Platform"]
  ]),
  cat("FARM_INFRASTRUCTURE", "SPRAYER", "Sprayer", "SPRAYER", [
    ["KNAPSACK_SPRAYER", "Knapsack Sprayer"], ["POWER_SPRAYER", "Power Sprayer"], ["BOOM_SPRAYER", "Boom Sprayer"],
    ["MIST_BLOWER", "Mist Blower"], ["DRONE_SPRAYER", "Drone Sprayer"]
  ]),
  cat("FARM_INFRASTRUCTURE", "IRRIGATION_SYSTEM", "Irrigation System", "IRRIGATION_PIPE", [
    ["DRIP_SYSTEM", "Drip System"], ["SPRINKLER_SYSTEM", "Sprinkler System"], ["FILTRATION_UNIT", "Filtration Unit"],
    ["FERTIGATION_UNIT", "Fertigation Unit"], ["IRRIGATION_CONTROLLER", "Irrigation Controller"]
  ]),
  cat("FARM_INFRASTRUCTURE", "GREENHOUSE", "Greenhouse / Shade House", "GREENHOUSE", [
    ["GREENHOUSE_STRUCTURE", "Greenhouse"], ["SHADE_HOUSE", "Shade House"], ["POLYTUNNEL", "Polytunnel"]
  ]),
  cat("FARM_INFRASTRUCTURE", "POULTRY_LIVESTOCK_EQUIPMENT", "Poultry / Livestock Equipment", "EQUIPMENT", [
    ["POULTRY_FEEDER", "Poultry Feeder"], ["POULTRY_DRINKER", "Poultry Drinker"], ["INCUBATOR", "Incubator / Hatchery"],
    ["BROODER", "Brooder"], ["TUNNEL_VENTILATION_FAN", "Tunnel Ventilation Fan"], ["MILKING_UNIT", "Milking Machine"],
    ["FEED_MIXER", "Feed Mixer"]
  ]),
  cat("FARM_INFRASTRUCTURE", "STORAGE_SILO", "Silo / Storage", "STORAGE_SILO", [
    ["GRAIN_SILO", "Grain Silo"], ["FEED_SILO", "Feed Silo"], ["PACKING_SHED", "Packing Shed"]
  ]),

  // ── Water / wastewater ───────────────────────────────────────────────────
  cat("WATER_WASTEWATER", "WATER_TREATMENT", "Water Treatment", undefined, [
    ["RO_PLANT", "RO Plant"], ["WATER_SOFTENER", "Water Softener"], ["SAND_CARBON_FILTER", "Sand / Carbon Filter"],
    ["UV_STERILIZER", "UV Sterilizer"], ["CHLORINATION_UNIT", "Chlorination Unit"]
  ]),
  cat("WATER_WASTEWATER", "WASTEWATER_TREATMENT", "Wastewater Treatment", undefined, [
    ["ETP", "Effluent Treatment Plant (ETP)"], ["STP", "Sewage Treatment Plant (STP)"], ["BIOGAS_DIGESTER", "Biogas Digester"],
    ["SEPTIC_TANK", "Septic Tank"]
  ]),

  // ── Fire / safety / security ─────────────────────────────────────────────
  cat("FIRE_SAFETY", "FIRE_EXTINGUISHER", "Fire Extinguisher", undefined, [
    ["WATER_EXTINGUISHER", "Water Extinguisher"], ["FOAM_EXTINGUISHER", "Foam Extinguisher"], ["ABC_POWDER_EXTINGUISHER", "ABC Powder Extinguisher"],
    ["WET_CHEMICAL_EXTINGUISHER", "Wet Chemical Extinguisher"]
  ]),
  cat("FIRE_SAFETY", "FIRE_SYSTEM", "Fire Protection System", undefined, [
    ["FIRE_PUMP", "Fire Pump"], ["HYDRANT", "Hydrant"], ["HOSE_REEL", "Hose Reel"], ["SPRINKLER_FIRE", "Fire Sprinkler System"],
    ["FIRE_ALARM_PANEL", "Fire Alarm Panel"], ["SMOKE_DETECTOR", "Smoke / Heat Detector"], ["FIRE_DOOR", "Fire Door"]
  ]),
  cat("SECURITY", "SECURITY_SYSTEM", "Security System", undefined, [
    ["CCTV_CAMERA", "CCTV Camera"], ["NVR_DVR", "NVR / DVR"], ["ACCESS_CONTROL", "Access Control"], ["INTRUSION_ALARM", "Intrusion Alarm"],
    ["BOOM_GATE", "Boom Gate"], ["GATE_MOTOR", "Automatic Gate Motor"], ["BIOMETRIC_ATTENDANCE", "Biometric Attendance Device"]
  ]),

  // ── IT / outlets / lab / kitchen / energy ────────────────────────────────
  cat("IT_HARDWARE", "IT_DEVICE", "IT Device", undefined, [
    ["DESKTOP_PC", "Desktop PC"], ["SERVER", "Server"], ["PRINTER", "Printer"], ["TABLET", "Tablet"], ["MOBILE_PHONE", "Mobile Phone"],
    ["NETWORK_SWITCH", "Network Switch"], ["ROUTER_FIREWALL", "Router / Firewall"], ["WIFI_ACCESS_POINT", "WiFi Access Point"],
    ["BARCODE_SCANNER", "Barcode Scanner"], ["POS_TERMINAL", "POS Terminal"], ["RECEIPT_PRINTER", "Receipt Printer"]
  ]),
  cat("OUTLET_EQUIPMENT", "OUTLET_FIXTURE", "Outlet Equipment", undefined, [
    ["DISPLAY_RACK", "Display Rack"], ["BILLING_COUNTER", "Billing Counter"], ["OUTLET_SIGNAGE", "Signage / Branding Board"],
    ["OUTLET_WEIGHING_SCALE", "Weighing Scale"], ["JUICE_DISPENSER", "Juice / Beverage Dispenser"], ["SHOP_SHUTTER", "Roller Shutter"]
  ]),
  cat("LABORATORY", "LAB_INSTRUMENT", "Laboratory Instrument", undefined, [
    ["PH_METER", "pH Meter"], ["REFRACTOMETER", "Refractometer (Brix)"], ["MOISTURE_ANALYZER", "Moisture Analyzer"],
    ["ANALYTICAL_BALANCE", "Analytical Balance"], ["INCUBATOR_LAB", "Lab Incubator"], ["AUTOCLAVE", "Autoclave"],
    ["MICROSCOPE", "Microscope"], ["FUME_HOOD", "Fume Hood"]
  ]),
  cat("CALIBRATION", "MEASURING_INSTRUMENT", "Measuring Instrument", undefined, [
    ["THERMOMETER", "Thermometer / Temperature Probe"], ["PRESSURE_GAUGE", "Pressure Gauge"], ["DATA_LOGGER", "Temperature Data Logger"],
    ["FLOW_METER", "Flow Meter"], ["TEST_WEIGHT_SET", "Test Weight Set"], ["MULTIMETER", "Multimeter"]
  ]),
  cat("KITCHEN_CANTEEN", "KITCHEN_EQUIPMENT", "Kitchen Equipment", undefined, [
    ["COOKING_RANGE", "Cooking Range"], ["GAS_BURNER", "Gas Burner"], ["STEAMER", "Steamer"], ["DEEP_FRYER", "Deep Fryer"],
    ["DISHWASHER", "Dishwasher"], ["KITCHEN_GRINDER", "Wet Grinder"], ["HOT_DISPLAY", "Hot Display / Bain Marie"]
  ]),
  cat("ENERGY_SOLAR", "SOLAR_SYSTEM", "Solar System", undefined, [
    ["SOLAR_PANEL_ARRAY", "Solar Panel Array"], ["SOLAR_INVERTER", "Solar Inverter"], ["SOLAR_BATTERY", "Solar Battery Storage"],
    ["SOLAR_WATER_HEATER", "Solar Water Heater"], ["SOLAR_PUMP", "Solar Pump"]
  ]),
  cat("TOOLS_MOULDS_JIGS", "TOOL", "Tool", "TOOL", [
    ["POWER_DRILL", "Power Drill"], ["ANGLE_GRINDER", "Angle Grinder"], ["IMPACT_WRENCH", "Impact Wrench"], ["TORQUE_WRENCH", "Torque Wrench"],
    ["MEASURING_TOOL", "Measuring Tool"], ["MOULD", "Mould"], ["JIG_FIXTURE", "Jig / Fixture"]
  ]),

  // ── Facility / civil ─────────────────────────────────────────────────────
  cat("FACILITY_CIVIL", "INFRASTRUCTURE", "Infrastructure", "INFRASTRUCTURE", [
    ["BUILDING", "Building"], ["ROOF", "Roof"], ["ROLLER_SHUTTER", "Roller Shutter"], ["DOOR_WINDOW", "Door / Window"],
    ["BOUNDARY_WALL_FENCE", "Boundary Wall / Fence"], ["GATE", "Gate"], ["WATER_TANK_STRUCTURE", "Water Tank Structure"],
    ["LOADING_BAY", "Loading Bay"], ["FLOORING", "Industrial Flooring"]
  ]),
  cat("EXTERNAL_INFRASTRUCTURE", "ROAD_DRAIN", "Road / Drain", undefined, [
    ["CULVERT", "Culvert"], ["BRIDGE", "Bridge"], ["CAR_PARK", "Car Park"], ["RETAINING_WALL", "Retaining Wall"]
  ])
];
