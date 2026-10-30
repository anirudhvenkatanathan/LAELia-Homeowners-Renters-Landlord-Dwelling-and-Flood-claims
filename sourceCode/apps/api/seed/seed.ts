// One-time loader: replaces the contents of every collection that has a file in seed/ClaimDB.
//   MONGODB_URI=... npm run seed          (add --yes to skip the confirmation delay)
// Never runs inside the Netlify function.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function main() {
  const uri = process.env['MONGODB_URI'] ?? process.env['MONGO_URI'];
  if (!uri) throw new Error('Set MONGODB_URI to the new Atlas database before running the seed.');
  const dir = path.resolve(__dirname, 'ClaimDB');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  console.log(`Target database: ${db.databaseName}. This REPLACES ${files.length} collections.`);
  if (!process.argv.includes('--yes')) { console.log('Starting in 8 seconds (Ctrl+C to abort, or pass --yes)…'); await new Promise((r) => setTimeout(r, 8000)); }
  const { EJSON } = mongoose.mongo.BSON;
  for (const f of files) {
    const coll = f.replace(/\.json$/, '').replace(/^[^.]*\./, '');
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, f), 'utf8') || '[]', { relaxed: false }) as Record<string, unknown>[];
    await db.collection(coll).deleteMany({});
    if (docs.length) await db.collection(coll).insertMany(docs, { ordered: false });
    console.log(`${coll}: ${docs.length}`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
