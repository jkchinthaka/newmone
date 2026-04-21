import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"]
};

export default config;
