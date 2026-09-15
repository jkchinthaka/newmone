import {
  EXISTING_NAV_ROUTES,
  getVisibleNavigationItems
} from "../../web/lib/navigation";
import {
  filterCommandPaletteItems,
  getCommandPaletteItems,
  isCommandPaletteShortcut,
  usesLegacyHomeAsDashboard
} from "../../web/lib/command-palette";
import { DEFAULT_POST_LOGIN_REDIRECT, LEGACY_FMS_HOME_PATH } from "../../web/lib/role-redirect";

describe("command palette helpers (Phase 1 CMMS scope)", () => {
  it("includes Assets command for facility manager roles", () => {
    const commands = getCommandPaletteItems("FACILITY_MANAGER");
    const assets = commands.find((item) => item.href === "/assets");

    expect(assets).toBeDefined();
    expect(assets?.label).toBe("Assets");
  });

  it("finds Spare Parts via inventory keyword search", () => {
    const commands = getCommandPaletteItems("ADMIN");
    const matches = filterCommandPaletteItems(commands, "inventory");

    expect(matches.some((item) => item.href === "/inventory")).toBe(true);
  });

  it("builds role-filtered commands from navigation config", () => {
    const adminCommands = getCommandPaletteItems("ADMIN");
    const technicianCommands = getCommandPaletteItems("TECHNICIAN");

    expect(adminCommands.some((item) => item.href === "/action-center")).toBe(true);
    expect(adminCommands.some((item) => item.href === "/inventory")).toBe(true);
    expect(technicianCommands.some((item) => item.href === "/work-orders")).toBe(true);
    expect(technicianCommands.some((item) => item.href === "/admin")).toBe(false);
  });

  it("returns action-center commands for unknown roles", () => {
    const commands = getCommandPaletteItems("UNKNOWN_ROLE");

    expect(commands.length).toBeGreaterThan(0);
    expect(commands[0]?.href).toBe(DEFAULT_POST_LOGIN_REDIRECT);
  });

  it("does not treat /home as the primary Home command", () => {
    const adminCommands = getCommandPaletteItems("ADMIN");
    const home = adminCommands.find((item) => item.id === "home");
    const legacy = adminCommands.find((item) => item.href === LEGACY_FMS_HOME_PATH);

    expect(home?.href).toBe("/action-center");
    expect(home?.label).toBe("Home");
    expect(usesLegacyHomeAsDashboard(adminCommands)).toBe(false);
    expect(legacy).toBeUndefined();
  });

  it("filters commands by label and keyword search", () => {
    const commands = getCommandPaletteItems("ADMIN");
    const byLabel = filterCommandPaletteItems(commands, "spare");
    const byKeyword = filterCommandPaletteItems(commands, "parts");

    expect(byLabel.some((item) => item.href === "/inventory")).toBe(true);
    expect(byKeyword.some((item) => item.href === "/inventory")).toBe(true);
  });

  it("returns empty results for unmatched search queries", () => {
    const commands = getCommandPaletteItems("TECHNICIAN");
    expect(filterCommandPaletteItems(commands, "zzzz-no-match")).toEqual([]);
  });

  it("returns all allowed commands when search query is empty", () => {
    const commands = getCommandPaletteItems("INVENTORY_KEEPER");
    expect(filterCommandPaletteItems(commands, "   ")).toHaveLength(commands.length);
  });

  it("maps command hrefs to existing navigation routes only", () => {
    const adminCommands = getCommandPaletteItems("ADMIN");
    expect(
      adminCommands.every((item) => EXISTING_NAV_ROUTES.has(item.href.split("?")[0]))
    ).toBe(true);
  });

  it("detects command palette keyboard shortcut", () => {
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(true);
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: false, metaKey: true, altKey: false, shiftKey: false })).toBe(true);
    expect(isCommandPaletteShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })).toBe(false);
    expect(isCommandPaletteShortcut({ key: "j", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(false);
  });

  it("stays aligned with visible navigation items for each role", () => {
    const roles = ["ADMIN", "TECHNICIAN", "CLEANER", null] as const;

    for (const role of roles) {
      const navItems = getVisibleNavigationItems(role);
      const commands = getCommandPaletteItems(role);
      expect(commands.map((item) => item.id)).toEqual(navItems.map((item) => item.id));
    }
  });

  it("does not invent FG Digital Records in palette (external FG SSO only)", () => {
    const without = getCommandPaletteItems("ADMIN");
    expect(without.some((item) => item.href === "/fg")).toBe(false);

    const withFg = getCommandPaletteItems("ADMIN", { permissions: ["fg.access"] });
    expect(withFg.some((item) => item.href === "/fg")).toBe(false);
  });

  it("adds a work-order search jump for typed queries", () => {
    const commands = getCommandPaletteItems("TECHNICIAN");
    const matches = filterCommandPaletteItems(commands, "WO-1042");
    expect(matches.some((item) => item.href === "/work-orders?q=WO-1042")).toBe(true);
  });
});
