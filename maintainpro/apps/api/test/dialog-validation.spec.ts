import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { validatePromptInput } from "../../web/lib/prompt-validation";

const WEB_ROOT = join(__dirname, "../../web");
const HIGH_IMPACT_PATHS = [
  "components/work-orders",
  "app/(dashboard)/vehicles",
  "app/(dashboard)/notifications",
  "app/(dashboard)/master-data/departments",
  "app/(dashboard)/maintenance/job-codes"
];

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(tsx|ts|jsx|js)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("validatePromptInput", () => {
  it("returns required message when value is empty and required", () => {
    expect(validatePromptInput("   ", { required: true })).toBe("This field is required.");
    expect(
      validatePromptInput("", { required: true, requiredMessage: "User ID is required." })
    ).toBe("User ID is required.");
  });

  it("allows empty values when not required", () => {
    expect(validatePromptInput("", { required: false })).toBeNull();
    expect(validatePromptInput("   ", { required: false })).toBeNull();
  });

  it("runs custom validation after trimming", () => {
    expect(
      validatePromptInput("  not-a-date  ", {
        required: false,
        validate: (value: string) => (Number.isNaN(Date.parse(value)) ? "Invalid date" : null)
      })
    ).toBe("Invalid date");

    expect(
      validatePromptInput("  2026-05-02T15:00:00.000Z  ", {
        required: false,
        validate: (value: string) => (Number.isNaN(Date.parse(value)) ? "Invalid date" : null)
      })
    ).toBeNull();
  });

  it("accepts non-empty required values", () => {
    expect(validatePromptInput("usr_123", { required: true })).toBeNull();
  });
});

describe("high-impact web flows avoid browser-native dialogs", () => {
  it("does not use window.alert, window.confirm, or window.prompt", () => {
    const offenders: string[] = [];

    for (const relativePath of HIGH_IMPACT_PATHS) {
      const absoluteDir = join(WEB_ROOT, relativePath);
      for (const file of collectSourceFiles(absoluteDir)) {
        const source = readFileSync(file, "utf8");
        if (/window\.(alert|confirm|prompt)\b/.test(source)) {
          offenders.push(file.replace(WEB_ROOT, "apps/web"));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
