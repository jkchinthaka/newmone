# Phase 10 — Full Fleet Maintenance & Administration

**Branch:** `maintainpro/phase-10-fleet`

## Key design

A Vehicle is an Asset with vehicle-specific data (`Vehicle.assetId` → Asset). Shared WO / PM / compliance engines apply; fleet adds tyres, batteries, fuel, gate, accidents, claims, fines.

## Delivered

- `Vehicle.assetId` FK + link API
- `VehicleTyre` / `VehicleBattery` lifecycle
- Gate-out evaluation (active vehicle/driver, licence, insurance, revenue licence, critical service, block) + override with permission/reason/audit
- Fuel efficiency (km/L, cost/km, soft abnormal band — configurable, not Nelna-certified)
- Accident → repair WO → optional insurance claim linkage

## API

`/fleet-lifecycle/vehicles/:id/link-asset`  
`/fleet-lifecycle/tyres`  
`/fleet-lifecycle/batteries`  
`/fleet-lifecycle/gate-out`  
`/fleet-lifecycle/fuel-efficiency`  
`/fleet-lifecycle/accident-chain`

Existing modules retained: fuel, drivers, accidents, insurance-claims, traffic-fines, vehicle-documents, compliance.
