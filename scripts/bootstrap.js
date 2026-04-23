const fs = require("fs/promises");
const path = require("path");

/**
 * Check whether a path exists.
 * @param {string} filePath - Path to check.
 * @returns {Promise<boolean>}
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw new Error(`Failed to test path "${filePath}": ${error.message}`);
  }
}

/**
 * Ensure local .env is available by copying .env.example when missing.
 * @returns {Promise<void>}
 */
async function ensureEnvFile() {
  try {
    const projectRoot = path.resolve(__dirname, "..");
    const envPath = path.join(projectRoot, ".env");
    const envExamplePath = path.join(projectRoot, ".env.example");

    if (!(await exists(envPath))) {
      await fs.copyFile(envExamplePath, envPath);
    }
  } catch (error) {
    throw new Error(`Failed to ensure .env file: ${error.message}`);
  }
}

/**
 * Ensure resume token file exists for change stream restart safety.
 * @returns {Promise<void>}
 */
async function ensureResumeTokenFile() {
  try {
    const projectRoot = path.resolve(__dirname, "..");
    const resumePath = path.join(projectRoot, "sync_resume.json");
    if (!(await exists(resumePath))) {
      await fs.writeFile(resumePath, "null", "utf8");
    }
  } catch (error) {
    throw new Error(`Failed to ensure resume token file: ${error.message}`);
  }
}

/**
 * Run bootstrap setup.
 * @returns {Promise<void>}
 */
async function runBootstrap() {
  try {
    await ensureEnvFile();
    await ensureResumeTokenFile();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

runBootstrap();
