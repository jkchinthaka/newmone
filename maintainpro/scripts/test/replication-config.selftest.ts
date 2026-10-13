import assert from "node:assert/strict";

import { envValidationSchema } from "../../apps/api/src/config/env.validation";
import { getDatabaseReplicationConfig } from "../../apps/api/src/database/replication.config";

function runtime(env: NodeJS.ProcessEnv) {
  return getDatabaseReplicationConfig(env);
}

assert.equal(runtime({}).enabled, false);
assert.equal(runtime({ DATABASE_REPLICATION_ENABLED: "false" }).enabled, false);
assert.equal(runtime({ DATABASE_REPLICATION_ENABLED: "true" }).enabled, true);
assert.equal(runtime({ DATABASE_REPLICATION_ENABLED: "maybe" }).enabled, false);
assert.equal(
  runtime({ DATABASE_REPLICATION_ENABLED: "true", DATABASE_REPLICATION_MODE: "disabled" }).enabled,
  false
);

const base = { DATABASE_URL: "sqlserver://example", JWT_SECRET: "test-only-secret" };

const omitted = envValidationSchema.validate(base, { abortEarly: false, stripUnknown: true });
assert.equal(omitted.error, undefined);
assert.equal(omitted.value.DATABASE_REPLICATION_ENABLED, false);
assert.equal(runtime({}).enabled, omitted.value.DATABASE_REPLICATION_ENABLED);

const explicitFalse = envValidationSchema.validate(
  { ...base, DATABASE_REPLICATION_ENABLED: false },
  { abortEarly: false, stripUnknown: true }
);
assert.equal(explicitFalse.error, undefined);
assert.equal(explicitFalse.value.DATABASE_REPLICATION_ENABLED, false);

const explicitTrue = envValidationSchema.validate(
  { ...base, DATABASE_REPLICATION_ENABLED: true },
  { abortEarly: false, stripUnknown: true }
);
assert.equal(explicitTrue.error, undefined);
assert.equal(explicitTrue.value.DATABASE_REPLICATION_ENABLED, true);

const invalid = envValidationSchema.validate(
  { ...base, DATABASE_REPLICATION_ENABLED: "maybe" },
  { abortEarly: false, stripUnknown: true }
);
assert.notEqual(invalid.error, undefined);

console.log("replication-config: ok");
