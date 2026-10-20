/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: "test/.*\\.spec\\.ts$",
  moduleNameMapper: {
    "^@maintainpro/shared-types$": "<rootDir>/../../packages/shared-types/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", {
      tsconfig: "./tsconfig.json",
      diagnostics: { ignoreCodes: [6059, 151002] }
    }]
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"]
};
