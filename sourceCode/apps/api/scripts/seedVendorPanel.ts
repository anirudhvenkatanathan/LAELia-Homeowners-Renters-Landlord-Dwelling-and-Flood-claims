import 'dotenv/config';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

const READY_FOR_ACTIVATION = 'Ready for Activation';
const ACTIVE = 'Active';

const VENDOR_NAMES = [
  'Claimfox',
  'American Legal Records',
  'FIS',
  'LEIDOS QTC',
  'Advantage Investigations',
  'Command Investigations',
  'Delta Investigations',
  'Careworks',
  'Opus Medical',
  'Windham Group',
  'Amelio Health',
  'Paradigm',
  'Premier Comp Solutions',
  'Accuro Solutions',
  'Prodigy Services',
  'Cadense RX',
  'AVO T&T',
  'Praxis Consulting',
  'Claims IO',
];

const READY_FOR_ACTIVATION_VENDORS = new Set(['Windham Group', 'Amelio Health', 'Opus Medical', 'Premier Comp Solutions', 'Claims IO']);

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const statusCol = db.collection('vendor_status');
  const vendorCol = db.collection('vendor_details');

  // ── Ensure "Ready for Activation" status exists ──────────────────────────────
  const existingRfa = await statusCol.findOne({
    $or: [
      { VendorStatusName: READY_FOR_ACTIVATION },
      { VendorStatusCode: 'ReadyForActivation' },
    ],
  });
  let rfaId: mongoose.Types.ObjectId;
  if (existingRfa) {
    rfaId = existingRfa['_id'] as mongoose.Types.ObjectId;
    console.log('Status "Ready for Activation" already exists.');
  } else {
    const result = await statusCol.insertOne({
      VendorStatusCode: 'ReadyForActivation',
      VendorStatusName: READY_FOR_ACTIVATION,
    });
    rfaId = result.insertedId as mongoose.Types.ObjectId;
    console.log('Inserted status "Ready for Activation".');
  }

  // ── Look up "Active" status ───────────────────────────────────────────────────
  const activeStatus = await statusCol.findOne({
    $or: [{ VendorStatusName: ACTIVE }, { VendorStatusCode: ACTIVE }],
  });
  const activeId = activeStatus ? activeStatus['_id'] : null;
  if (!activeId) console.warn('Warning: "Active" status not found in vendor_status — Status field will be empty.');

  // ── Upsert vendors ────────────────────────────────────────────────────────────
  for (const companyName of VENDOR_NAMES) {
    const isRfa      = READY_FOR_ACTIVATION_VENDORS.has(companyName);
    const statusId   = isRfa ? rfaId : activeId;
    const statusName = isRfa ? READY_FOR_ACTIVATION : ACTIVE;

    const existing = await vendorCol.findOne({ companyName });
    if (existing) {
      await vendorCol.updateOne(
        { companyName },
        { $set: { vendorStatus: statusName, Status: statusId, vendorSource: 'panel', uploadedAt: new Date() } },
      );
      console.log(`Updated: ${companyName} → ${statusName}`);
    } else {
      await vendorCol.insertOne({
        vendorId:               uuidv4(),
        companyName,
        emailId:                '',
        rating:                 0,
        address:                '',
        city:                   '',
        state:                  '',
        country:                '',
        Coverage:               '',
        Status:                 statusId,
        vendorStatus:           statusName,
        vendorSource:           'panel',
        RequalificationEndDate: '',
        phoneNumber:            '',
        turnaroundTime:         '',
        serviceRequestRoleId:   '',
        serviceRequestRoleName: '',
        createdBy:              'admin',
        uploadedBy:             'admin',
        createdAt:              new Date(),
        uploadedAt:             new Date(),
      });
      console.log(`Inserted: ${companyName} → ${statusName}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
