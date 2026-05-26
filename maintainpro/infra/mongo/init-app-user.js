const databaseName = process.env.MONGO_INITDB_DATABASE || "bileeta_db";
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required to initialize the app database user.");
}

db = db.getSiblingDB(databaseName);

const existingUser = db.getUser(username);
if (!existingUser) {
  db.createUser({
    user: username,
    pwd: password,
    roles: [{ role: "readWrite", db: databaseName }]
  });
}