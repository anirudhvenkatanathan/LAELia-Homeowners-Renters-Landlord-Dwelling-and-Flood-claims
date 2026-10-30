import 'dotenv/config';
import mongoose from 'mongoose';
import { ensureServiceRequestRoleLOB } from '../services/serviceRequestRoleLOBBackfill';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

// Ad-hoc/manual equivalent of the same backfill + single-value-to-array
// migration server.ts now runs automatically on every startup (see
// services/serviceRequestRoleLOBBackfill.ts) — kept for environments where
// running a one-off script against a DB is preferred over waiting for/
// restarting the API server.
async function backfill(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await ensureServiceRequestRoleLOB();

  await mongoose.disconnect();
  console.log('Done.');
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
