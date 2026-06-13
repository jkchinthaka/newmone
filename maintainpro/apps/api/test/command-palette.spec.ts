import {
  EXISTING_NAV_ROUTES,
  getVisibleNavigationItems
} from "../../web/lib/navigation";
import {
  filterCommandPaletteItems,
  getCommandPaletteItems,
  getPrimaryDashboardCommand,
  isCommandPaletteShortcut,
  usesLegacyHomeAsDashboard
} from "../../web/lib/command-palette";
import { DEFAULT_POST_LOGIN_REDIRECT, LEGACY_FMS_HOME_PATH } from "../../web/lib/role-redirect";

describe("command palette helpers", () => {
  it("includes Facilities command for facility manager roles", () => {
    const commands = getCommandPaletteItems("FACILITY_MANAGER");
    const facilities = commands.find((item) => item.href === "/facilities");

    expect(facilities).toBeDefined();
    expect(facilities?.label).toBe("Facilities");
  });

  it("finds Facilities via hierarchy keyword search", () => {
    const commands = getCommandPaletteItems("ADMIN");
    const matches = filterCommandPaletteItems(commands, "hierarchy");

    expect(matches.some((item) => item.href === "/facilities")).toBe(true);
  });

  it("builds role-filtered commands from navigation config", () => {
    const adminCommands = getCommandPaletteItems("ADMIN");
    const technicianCommands = getCommandPaletteItems("TECHNICIAN");

    expect(adminCommands.some((item) => item.href === "/dashboard")).toBe(true);
    expect(adminCommands.some((item) => item.href === "/inventory")).toBe(true);
    expect(technicianCommands.some((item) => item.href === "/work-orders")).toBe(true);
    expect(technicianCommands.some((item) => item.href === "/inventory")).toBe(false);
  });

  it("returns dashboard-only commands for unknown roles", () => {
    const commands = getCommandPaletteItems("UNKNOWN_ROLE");

    expect(commands).toHaveLength(1);
    expect(commands[0]?.href).toBe(DEFAULT_POST_LOGIN_REDIRECT);
  });

  it("does not treat /home as the primary Dashboard command", () => {
    const adminCommands = getCommandPaletteItems("ADMIN");
    const dashboard = getPrimaryDashboardCommand(adminCommands);
    const legacy = adminCommands.find((item) => item.href === LEGACY_FMS_HOME_PATH);

    expect(dashboard?.href).toBe("/dashboard");
    expect(dashboard?.label).toBe("Dashboard");
    expect(usesLegacyHomeAsDashboard(adminCommands)).toBe(false);
    expect(legacy?.label).toBe("Legacy FMS Archive");
    expect(legacy?.legacy).toBe(true);
  });

  it("filters commands by label and keyword search", () => {
    const commands = getCommandPaletteItems("ADMIN");
    const byLabel = filterCommandPaletteItems(commands, "inventory");
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
    expect(adminCommands.every((item) => EXISTING_NAV_ROUTES.has(item.href))).toBe(true);
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
});
