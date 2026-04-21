/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"]
};
