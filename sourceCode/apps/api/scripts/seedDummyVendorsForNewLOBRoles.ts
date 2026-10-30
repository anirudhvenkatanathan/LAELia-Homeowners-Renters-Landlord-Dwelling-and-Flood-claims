import 'dotenv/config';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

// One dummy/placeholder vendor per Service Request Role that currently has
// none — specifically the GL/Auto/Property roles added alongside the LOB
// multi-select feature, which otherwise show an empty vendor list on every
// claim that matches them. roleId is hardcoded rather than looked up by
// roleName because "Independent Adjusters" exists twice (once per LOB) with
// two different roleIds. Idempotent: skips any role that already has a
// vendor pointing at it. Uses the raw driver (not the Mongoose model, whose
// serviceRequestRoleId schema type is a plain String) to write
// serviceRequestRoleId as a real array, matching every existing vendor_details
// record and what graphQL/vendorEntity.ts's resolvers actually expect —
// see scripts/activateDemoVendor.ts for the same raw-collection convention.
const DUMMY_VENDORS: Array<{
  roleId: string; roleName: string; companyName: string;
  city: string; state: string; coverage: string; turnaroundTime: string; rating: number;
}> = [
  { roleId: 'd6cbd9e1-5083-4fd3-ae41-42895d30deeb', roleName: 'Independent Adjusters',                companyName: 'Meridian GL Adjusters',                 city: 'Dallas',    state: 'TX', coverage: 'TX, OK, LA, NM', turnaroundTime: '48 Hours', rating: 4.2 },
  { roleId: 'fdc422d4-9f71-438e-ac77-fedf1378f4f7', roleName: 'Forensic Engineers',                    companyName: 'Apex Forensic Engineering',             city: 'Atlanta',   state: 'GA', coverage: 'GA, FL, AL, SC', turnaroundTime: '72 Hours', rating: 4.5 },
  { roleId: '8dacd136-20cf-4365-837c-a21855d5bca3', roleName: 'Auto Appraisers',                       companyName: 'Precision Auto Appraisals',             city: 'Phoenix',   state: 'AZ', coverage: 'AZ, NV, NM',     turnaroundTime: '24 Hours', rating: 4.3 },
  { roleId: '0bbf4eb0-433a-49e0-9fc4-a65e94fec5ee', roleName: 'Repair Networks',                       companyName: 'National Auto Repair Network',          city: 'Columbus',  state: 'OH', coverage: 'OH, IN, MI, KY', turnaroundTime: '48 Hours', rating: 4.1 },
  { roleId: 'dd85a729-d742-4277-b4c4-9d4b15afb9a0', roleName: 'Salvage and Towing Partnerships',       companyName: 'Reliable Salvage & Towing',             city: 'Charlotte', state: 'NC', coverage: 'NC, SC, VA',     turnaroundTime: '24 Hours', rating: 4.0 },
  { roleId: '9b957b16-5b16-4a93-9f69-67dd4fc565e3', roleName: 'Medical Review and Bill Examiners',     companyName: 'ClearPath Medical Bill Review',         city: 'Denver',    state: 'CO', coverage: 'CO, UT, WY',     turnaroundTime: '48 Hours', rating: 4.4 },
  { roleId: 'c366ed3e-49c7-44b6-8192-7d801e714dd0', roleName: 'Accident Reconstructionist',            companyName: 'Forensic Accident Reconstruction Group', city: 'Sacramento', state: 'CA', coverage: 'CA, NV, OR',    turnaroundTime: '72 Hours', rating: 4.6 },
  { roleId: '5ba3b67c-0a1e-46a8-a209-a6ea648d1aa1', roleName: 'Independent Adjusters',                 companyName: 'Summit Auto Claims Adjusters',          city: 'Chicago',   state: 'IL', coverage: 'IL, IN, WI',     turnaroundTime: '48 Hours', rating: 4.2 },
  { roleId: '6403ead4-26e8-4e7d-9fd0-3be887c111f5', roleName: '24/7 Loss Mitigation Contractors',      companyName: 'RapidResponse Loss Mitigation',         city: 'Tampa',     state: 'FL', coverage: 'FL, GA, AL',     turnaroundTime: '24 Hours', rating: 4.3 },
  { roleId: '85efc2b6-1027-41c7-8987-b5d05c63344b', roleName: 'Forensic Accountant',                   companyName: 'Ledger Forensic Accounting',            city: 'Boston',    state: 'MA', coverage: 'MA, CT, RI',     turnaroundTime: '72 Hours', rating: 4.5 },
  { roleId: 'f661ec4d-8dc4-4b0c-bcf2-cea1e2b99550', roleName: 'Appraisers/Independent Adjusters',      companyName: 'Cornerstone Property Adjusters',        city: 'Orlando',   state: 'FL', coverage: 'FL, GA, SC',     turnaroundTime: '48 Hours', rating: 4.1 },
  { roleId: '3f325fac-46b9-40a6-9d35-30f2541d7d14', roleName: 'Cause & Origin Specialists',            companyName: 'Ignis Cause & Origin Specialists',      city: 'Houston',   state: 'TX', coverage: 'TX, LA, AR',     turnaroundTime: '72 Hours', rating: 4.4 },
];

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const vendorCol = db.collection('vendor_details');
  const statusCol = db.collection('vendor_status');

  const activeStatus = await statusCol.findOne({
    $or: [{ VendorStatusCode: 'Active' }, { VendorStatusName: 'Active' }],
  });
  if (!activeStatus) {
    console.error('No "Active" record found in vendor_status — aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const now = new Date();
  const requalEnd = new Date(now);
  requalEnd.setFullYear(requalEnd.getFullYear() + 1);

  let created = 0;
  let skipped = 0;

  for (const v of DUMMY_VENDORS) {
    const existingCount = await vendorCol.countDocuments({ serviceRequestRoleId: v.roleId });
    if (existingCount > 0) {
      console.log(`Skipped "${v.roleName}" (${v.roleId}) — already has ${existingCount} vendor(s).`);
      skipped++;
      continue;
    }

    const slug = v.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    await vendorCol.insertOne({
      vendorId:                 uuidv4(),
      companyName:              v.companyName,
      emailId:                  `contact@${slug}.com`,
      rating:                   v.rating,
      address:                  '1 Main Street',
      city:                     v.city,
      state:                    v.state,
      country:                  'USA',
      Coverage:                 v.coverage,
      Status:                   activeStatus._id,
      vendorStatus:             'Active',
      vendorStatusId:           String(activeStatus['statusId'] ?? activeStatus._id),
      vendorSource:             '',
      RequalificationStartDate: now.toISOString(),
      RequalificationEndDate:   requalEnd.toISOString(),
      phoneNumber:              '+1 555-0100',
      turnaroundTime:           v.turnaroundTime,
      serviceRequestRoleId:     [v.roleId],
      serviceRequestRoleName:   v.roleName,
      createdBy:                'System (Dummy Seed)',
      createdAt:                now,
      uploadedBy:               'System (Dummy Seed)',
      uploadedAt:               now,
      boostApplied:             false,
      suspendedReason:          '',
      disqualifiedReason:       '',
    });

    console.log(`Created dummy vendor "${v.companyName}" for "${v.roleName}" (${v.roleId}).`);
    created++;
  }

  console.log(`Done. Created ${created}, skipped ${skipped} (already had a vendor).`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
