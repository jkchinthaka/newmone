#!/usr/bin/env node
/**
 * Optional object-storage cleanup for MaintainPro test/local objects only.
 *
 * Required:
 *   ALLOW_STORAGE_CLEAR=true
 *   CONFIRM_STORAGE_CLEAR=CLEAR_MAINTAINPRO_TEST_OBJECTS
 *   APP_ENVIRONMENT=local|test|development
 *
 * Supports MinIO/S3-compatible (MINIO_*) when configured.
 * Cloudinary: reports orphaned prefix listing guidance only (API delete must be explicit).
 * Never deletes production buckets.
 */
import {
  loadMaintainProEnv,
  printRedactedIdentity,
  resolveDatabaseTarget
} from "./lib/database-identity.mjs";

async function main() {
  loadMaintainProEnv();
  if ((process.env.ALLOW_STORAGE_CLEAR || "").trim() !== "true") {
    throw new Error("Refusing: ALLOW_STORAGE_CLEAR must be true");
  }
  if ((process.env.CONFIRM_STORAGE_CLEAR || "").trim() !== "CLEAR_MAINTAINPRO_TEST_OBJECTS") {
    throw new Error("Refusing: CONFIRM_STORAGE_CLEAR must be CLEAR_MAINTAINPRO_TEST_OBJECTS");
  }

  const target = resolveDatabaseTarget();
  printRedactedIdentity(target);
  const appEnv = (process.env.APP_ENVIRONMENT || "").toLowerCase();
  if (!["local", "test", "development", "dev"].includes(appEnv) && !["local", "test", "development"].includes(target.classification)) {
    throw new Error("Refusing storage clear: APP_ENVIRONMENT must be local|test|development");
  }
  if (target.classification === "production" || appEnv === "production" || appEnv === "prod") {
    throw new Error("Refusing storage clear against production");
  }

  const endpoint = (process.env.MINIO_ENDPOINT || "").trim();
  const bucket = (process.env.MINIO_BUCKET || "").trim();
  const accessKey = (process.env.MINIO_ACCESS_KEY || "").trim();
  const secretKey = (process.env.MINIO_SECRET_KEY || "").trim();
  const prefix = (process.env.MAINTAINPRO_STORAGE_PREFIX || "maintainpro/").trim();
  const expectedBucket = (process.env.EXPECTED_STORAGE_BUCKET || "").trim();

  if (!endpoint || !bucket) {
    console.log("Object storage: skipped (MINIO_ENDPOINT/MINIO_BUCKET unset)");
    console.log("Orphaned files: unknown — configure MinIO or clear Cloudinary folder manually");
    console.log(
      `Cloudinary folder hint: ${process.env.CLOUDINARY_ASSET_FOLDER || "maintainpro/asset-documents"}`
    );
    return;
  }

  if (expectedBucket && expectedBucket !== bucket) {
    throw new Error(`Bucket '${bucket}' does not match EXPECTED_STORAGE_BUCKET='${expectedBucket}'`);
  }
  if (/prod|production/i.test(bucket) && !/test|local|dev|staging/i.test(bucket)) {
    throw new Error(`Refusing to clear bucket that looks production-like: ${bucket}`);
  }

  let AWS;
  try {
    AWS = await import("@aws-sdk/client-s3");
  } catch {
    console.log("Object storage: @aws-sdk/client-s3 not installed — reporting config only");
    console.log(`Would clear prefix '${prefix}' in bucket '${bucket}' at host '${endpoint}'`);
    console.log("Install @aws-sdk/client-s3 or delete objects with mc/aws cli manually.");
    return;
  }

  const port = process.env.MINIO_PORT || "9000";
  const useSsl = String(process.env.MINIO_USE_SSL || "false").toLowerCase() === "true";
  const forcePath = String(process.env.MINIO_FORCE_PATH_STYLE || "true").toLowerCase() !== "false";
  const base = endpoint.includes("://") ? endpoint : `${useSsl ? "https" : "http"}://${endpoint}${port ? `:${port}` : ""}`;

  const client = new AWS.S3Client({
    endpoint: base,
    region: process.env.MINIO_REGION || "us-east-1",
    forcePathStyle: forcePath,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }
  });

  let deleted = 0;
  let listed = 0;
  let token;
  do {
    const page = await client.send(
      new AWS.ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token
      })
    );
    const contents = page.Contents || [];
    listed += contents.length;
    if (contents.length) {
      const res = await client.send(
        new AWS.DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: contents.map((o) => ({ Key: o.Key })),
            Quiet: true
          }
        })
      );
      deleted += (res.Deleted || []).length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  console.log(`Listed objects under ${prefix}: ${listed}`);
  console.log(`Deleted objects: ${deleted}`);
  console.log(`Orphaned (outside prefix): not scanned — review bucket '${bucket}' separately`);
}

main().catch((err) => {
  console.error(`STORAGE CLEAR FAILED: ${err.message}`);
  process.exit(1);
});