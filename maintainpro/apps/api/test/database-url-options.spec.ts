import {
  normalizeDatabaseEnvironment,
  resolveEnvReference,
  withMongoConnectionTimeouts
} from "../src/config/database-url-options";

describe("database URL option normalization", () => {
  it("resolves env references", () => {
    expect(
      resolveEnvReference("${PRIMARY_DATABASE_URL}", {
        PRIMARY_DATABASE_URL: "mongodb://localhost:27017/nelna"
      })
    ).toBe("mongodb://localhost:27017/nelna");
  });

  it("adds bounded MongoDB connection timeouts when missing", () => {
    const url = withMongoConnectionTimeouts("mongodb+srv://user:pass@example.mongodb.net/nelna?appName=Nelna", {});

    expect(url).toContain("appName=Nelna");
    expect(url).toContain("serverSelectionTimeoutMS=5000");
    expect(url).toContain("connectTimeoutMS=5000");
  });

  it("does not override explicitly configured timeout options", () => {
    const url = withMongoConnectionTimeouts(
      "mongodb://localhost:27017/nelna?serverSelectionTimeoutMS=9000&connectTimeoutMS=8000",
      {
        DATABASE_SERVER_SELECTION_TIMEOUT_MS: "5000",
        DATABASE_CONNECT_TIMEOUT_MS: "5000"
      }
    );

    expect(url).toContain("serverSelectionTimeoutMS=9000");
    expect(url).toContain("connectTimeoutMS=8000");
  });

  it("normalizes primary aliases and Render defaults", () => {
    const env: NodeJS.ProcessEnv = {
      RENDER: "true",
      PRIMARY_DATABASE_URL: "mongodb://localhost:27017/nelna",
      DATABASE_URL: "${PRIMARY_DATABASE_URL}",
      MONGODB_URI: "${PRIMARY_DATABASE_URL}",
      CORS_ORIGIN: "https://example.com, https://preview.example.com"
    };

    normalizeDatabaseEnvironment(env);

    expect(env.NODE_ENV).toBe("production");
    expect(env.DATABASE_URL).toBe(env.PRIMARY_DATABASE_URL);
    expect(env.MONGODB_URI).toBe(env.PRIMARY_DATABASE_URL);
    expect(env.PRIMARY_DATABASE_URL).toContain("serverSelectionTimeoutMS=5000");
    expect(env.FRONTEND_URL).toBe("https://example.com");
  });
});