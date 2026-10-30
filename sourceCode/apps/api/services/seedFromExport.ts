import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

/**
 * Loads a MongoDB Compass/mongoexport JSON dump (files named
 * `<db>.<collection>.json`, Extended JSON arrays) into the connected database.
 *
 * Runs only when SEED_ON_EMPTY=true AND the database has no login users yet,
 * so it is safe to leave enabled: it never touches a database that has data.
 */
function resolveSeedDir(): string | null {
  const candidates = [
    process.env['SEED_DIR'],
    path.resolve(process.cwd(), 'seed/ClaimDB'),
    path.resolve(process.cwd(), '../../../seed/ClaimDB'),
    path.resolve(__dirname, '../../../../seed/ClaimDB'),
    path.resolve(__dirname, '../../../../../seed/ClaimDB'),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export async function seedFromExportIfEmpty(): Promise<void> {
  if (process.env['SEED_ON_EMPTY'] !== 'true') return;

  const db = mongoose.connection.db;
  if (!db) throw new Error('seedFromExportIfEmpty: no database connection');

  // Mongoose auto-creates empty collections for registered models on connect,
  // so "empty" means: no login users yet (the export always contains some).
  const users = await db.collection('login_user').estimatedDocumentCount();
  if (users > 0) {
    console.log(`Seed skipped: database already has ${users} login user(s).`);
    return;
  }

  const dir = resolveSeedDir();
  if (!dir) {
    console.warn('Seed skipped: seed/ClaimDB folder not found.');
    return;
  }

  const { EJSON } = mongoose.mongo.BSON;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  let total = 0;
  for (const file of files) {
    // "claim_triage.login_user.json" -> "login_user"
    const base = file.replace(/\.json$/, '');
    const collection = base.includes('.') ? base.slice(base.indexOf('.') + 1) : base;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    const parsed = raw ? EJSON.parse(raw, { relaxed: false }) : [];
    const docs = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
    if (docs.length > 0) {
      try {
        await db.collection(collection).insertMany(docs, { ordered: false });
      } catch (err) {
        // ordered:false inserts everything it can; report skipped duplicates and continue
        console.warn(`Seed ${collection}: some documents skipped — ${(err as Error).message}`);
      }
    }
    total += docs.length;
    console.log(`Seeded ${collection}: ${docs.length}`);
  }
  console.log(`Seed complete: ${files.length} collections, ${total} documents.`);
}
