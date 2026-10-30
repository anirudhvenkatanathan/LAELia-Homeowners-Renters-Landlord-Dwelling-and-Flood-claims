import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

// One-off fix for the "Active Service Provider" quick-login demo account
// (AGS Solutions), which was stuck mid-onboarding instead of Active.
const VENDOR_ID = '23856859-b963-4d03-9c1b-c0c8fd55458e';

async function run(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const vendorCol = db.collection('vendor_details');
  const statusCol = db.collection('vendor_status');

  const vendor = await vendorCol.findOne({ vendorId: VENDOR_ID });
  if (!vendor) {
    console.error(`Vendor ${VENDOR_ID} not found — aborting.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const activeStatus = await statusCol.findOne({
    $or: [{ VendorStatusCode: 'Active' }, { VendorStatusName: 'Active' }],
  });
  if (!activeStatus) {
    console.error('No "Active" record found in vendor_status — aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();
  const nextRequalEndDate = new Date(now);
  nextRequalEndDate.setFullYear(nextRequalEndDate.getFullYear() + 1);

  await vendorCol.updateOne(
    { vendorId: VENDOR_ID },
    {
      $set: {
        vendorStatus:             'Active',
        vendorStatusId:           String(activeStatus['statusId'] ?? ''),
        Status:                   activeStatus['_id'],
        manualStatusOverride:     true,
        suspendedReason:          '',
        disqualifiedReason:       '',
        RequalificationStartDate: now.toISOString(),
        RequalificationEndDate:   nextRequalEndDate.toISOString(),
      },
    },
  );

  console.log(`Vendor ${VENDOR_ID} (${vendor['companyName']}) set to Active.`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
