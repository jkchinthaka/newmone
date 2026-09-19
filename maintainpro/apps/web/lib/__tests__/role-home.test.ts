import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveRoleHome, filterRoleHomeCards, ROLE_HOME_PROFILES } from "../role-home";

test("resolveRoleHome: PROCUREMENT_OFFICER resolves to the PROCUREMENT profile, not the REQUESTER fallback", () => {
  const profile = resolveRoleHome("PROCUREMENT_OFFICER");
  assert.equal(profile.roleKey, "PROCUREMENT");
  assert.equal(profile.title, "Procurement Home");
  const cardIds = profile.cards.map((c) => c.id);
  assert.ok(cardIds.includes("procurement-queue"));
  assert.ok(cardIds.includes("procurement-vendors"));
  assert.ok(cardIds.includes("inventory-overview"));
});

test("resolveRoleHome: technician-bucket roles -> TECHNICIAN profile", () => {
  assert.equal(resolveRoleHome("TECHNICIAN").roleKey, "TECHNICIAN");
  assert.equal(resolveRoleHome("MECHANIC").roleKey, "TECHNICIAN");
});

test("resolveRoleHome: supervisor-bucket roles -> SUPERVISOR profile", () => {
  assert.equal(resolveRoleHome("SUPERVISOR").roleKey, "SUPERVISOR");
  assert.equal(resolveRoleHome("MAINTENANCE_SUPERVISOR").roleKey, "SUPERVISOR");
});

test("resolveRoleHome: fleet-bucket roles -> FLEET profile", () => {
  assert.equal(resolveRoleHome("FLEET_MANAGER").roleKey, "FLEET");
  assert.equal(resolveRoleHome("DRIVER").roleKey, "FLEET");
  assert.equal(resolveRoleHome("SECURITY_OFFICER").roleKey, "FLEET");
});

test("resolveRoleHome: manager-bucket roles -> MANAGER profile", () => {
  for (const role of ["MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "ADMIN", "SUPER_ADMIN"]) {
    assert.equal(resolveRoleHome(role).roleKey, "MANAGER", role);
  }
});

test("resolveRoleHome: viewer/finance-bucket roles -> MANAGEMENT_VIEWER profile", () => {
  for (const role of ["VIEWER", "AUDITOR", "FINANCE", "FINANCE_APPROVER"]) {
    assert.equal(resolveRoleHome(role).roleKey, "MANAGEMENT_VIEWER", role);
  }
});

test("resolveRoleHome: unmapped/unknown roles fall back to REQUESTER", () => {
  assert.equal(resolveRoleHome("REQUESTER").roleKey, "REQUESTER");
  assert.equal(resolveRoleHome("SOME_UNKNOWN_ROLE").roleKey, "REQUESTER");
  assert.equal(resolveRoleHome(null).roleKey, "REQUESTER");
  assert.equal(resolveRoleHome(undefined).roleKey, "REQUESTER");
});

test("resolveRoleHome: case-insensitive and trims whitespace", () => {
  assert.equal(resolveRoleHome("  procurement_officer ").roleKey, "PROCUREMENT");
  assert.equal(resolveRoleHome("manager").roleKey, "MANAGER");
});

test("every ROLE_HOME_PROFILES entry has at least one card with a non-empty href", () => {
  for (const profile of ROLE_HOME_PROFILES) {
    assert.ok(profile.cards.length > 0, `${profile.roleKey} has no cards`);
    for (const card of profile.cards) {
      assert.ok(card.href.startsWith("/"), `${profile.roleKey}/${card.id} href should be an app path`);
    }
  }
});

test("filterRoleHomeCards: empty query returns all cards unchanged", () => {
  const profile = resolveRoleHome("MANAGER");
  assert.deepEqual(filterRoleHomeCards(profile.cards, ""), profile.cards);
  assert.deepEqual(filterRoleHomeCards(profile.cards, "   "), profile.cards);
});

test("filterRoleHomeCards: matches title or description, case-insensitive", () => {
  const profile = resolveRoleHome("PROCUREMENT_OFFICER");
  const byTitle = filterRoleHomeCards(profile.cards, "vendors");
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, "procurement-vendors");

  const byDescription = filterRoleHomeCards(profile.cards, "stock levels");
  assert.equal(byDescription.length, 1);
  assert.equal(byDescription[0].id, "inventory-overview");

  const noMatch = filterRoleHomeCards(profile.cards, "zzz-nonexistent");
  assert.equal(noMatch.length, 0);
});
