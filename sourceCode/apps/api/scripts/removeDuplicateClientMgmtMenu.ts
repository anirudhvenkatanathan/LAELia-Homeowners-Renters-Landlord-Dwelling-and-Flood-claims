import 'dotenv/config';
import mongoose from 'mongoose';
import { MenuItemModel } from '../graphQL/menuEntity';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

// menu-active-vendor-performance was manually renamed to "Client Management"
// (path /vendors/active/clients), making the separately-seeded
// menu-active-vendor-client-mgmt entry a duplicate of the same label/path.
async function run(): Promise<void> {
  await mongoose.connect(
    MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await MenuItemModel.deleteOne({ id: 'menu-active-vendor-client-mgmt' });
  console.log(result.deletedCount > 0
    ? 'Removed duplicate menu-active-vendor-client-mgmt.'
    : 'No duplicate menu-active-vendor-client-mgmt found — nothing to do.');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
