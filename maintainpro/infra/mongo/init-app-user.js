const databaseName = process.env.MONGO_INITDB_DATABASE || "bileeta_db";
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
const primaryName = process.env.PRIMARY_DATABASE_NAME || databaseName;
const backupName = process.env.BACKUP_DATABASE_NAME || databaseName;

if (!username || !password) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required to initialize the app database user.");
}

const roleDbNames = Array.from(
  new Set([databaseName, primaryName, backupName].filter(Boolean))
);

const roles = roleDbNames.map((dbName) => ({ role: "readWrite", db: dbName }));

db = db.getSiblingDB(databaseName);

const existingUser = db.getUser(username);
if (!existingUser) {
  db.createUser({
    user: username,
    pwd: password,
    roles
  });
} else {
  // Ensure roles cover app databases (idempotent for disposable E2E volumes).
  db.updateUser(username, { roles });
}
