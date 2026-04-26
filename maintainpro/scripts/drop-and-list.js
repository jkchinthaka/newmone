// Diagnostic: list & optionally drop the nelna database.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('nelna');
  const cols = await db.listCollections().toArray();
  console.log('Collections in nelna:', cols.length);
  for (const c of cols) {
    const cnt = await db.collection(c.name).countDocuments();
    console.log(`  ${c.name}: ${cnt}`);
  }
  if (process.argv.includes('--drop')) {
    console.log('Dropping database nelna...');
    await db.dropDatabase();
    console.log('Dropped.');
  }
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
