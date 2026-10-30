import 'dotenv/config';
import mongoose from 'mongoose';
import { DemoUserModel } from '../graphQL/loginEntity';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

// One-time migration: populates the demo_users table from the definitions
// that used to be hardcoded directly in seedLoginData.ts. Run this once
// (`ts-node scripts/migrateDemoUsersToTable.ts`) before running seedLoginData,
// which now reads DEMO_USERS from this table instead of a hardcoded array.
//
// Per-role menu grants match the deployed prod site's sidebars exactly:
//  - Admin:             Dashboard + full Service Provider group + Claims Orchestration Engine
//                        (no Claims Command Center, no Service Provider Benchmarking)
//  - Claims Adjuster:   Claims Command Center + Supervisor Comments
//  - Claims Supervisor: everything Admin has, plus Claims Command Center and
//                        Service Provider Benchmarking
const ADMIN_MENU_IDS = [
  'menu-dashboard-001',
  'menu-admin-vendor-management-001',
  'menu-admin-vendor-onboarding-001',
  'menu-admin-vendor-panel-001',
  'menu-admin-kpi-metrics',
  'menu-vendor-request-001',
  'menu-service-request-role-001',
];
export const ADJUSTER_MENU_IDS = [
  'menu-claim-intake-001',
  'menu-claim-supervisor-comments-001',
];
const SUPERVISOR_MENU_IDS = [
  ...ADMIN_MENU_IDS,
  'menu-claim-intake-001',
  'menu-admin-analytics-insight-001',
];

// loginId values below match the live login_user documents exactly (not a
// naming convention) — 2 of the 3 predate this file and were seeded under
// different ids (clientadj-login-001 / client-login-001) than their own
// email/username would suggest; kept as-is rather than migrating the live
// records, since nothing else needs to change to fix seedLoginData.ts's
// "duplicate email on insert" failure this caused.
const DEMO_USER_SEED_DATA = [
  { loginId: 'admin-login-001',      email: 'admin@laelia.com',      username: 'admin',       password: 'admin@123',  fullName: '',            roleName: 'Admin',             menuIds: ADMIN_MENU_IDS },
  { loginId: 'clientadj-login-001',  email: 'claimsadj@laelia.com',  username: 'claimsadj',   password: 'client@123', fullName: 'Priya Nair',  roleName: 'Claims Adjuster',   menuIds: ADJUSTER_MENU_IDS },
  { loginId: 'client-login-001',     email: 'claimssupr@laelia.com', username: 'claimssupr',  password: 'client@123', fullName: '',            roleName: 'Claims Supervisor', menuIds: SUPERVISOR_MENU_IDS },
];

async function migrate(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  for (const u of DEMO_USER_SEED_DATA) {
    // $setOnInsert + upsert keeps this idempotent across repeated runs and
    // won't clobber any later edits made directly against demo_users.
    const result = await DemoUserModel.updateOne(
      { loginId: u.loginId },
      { $setOnInsert: { ...u, createdBy: 'system', updatedBy: 'system' } },
      { upsert: true },
    );
    console.log(result.upsertedCount ? `Inserted demo_users record: ${u.loginId}` : `demo_users record already exists: ${u.loginId}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

// Guarded so importing ADJUSTER_MENU_IDS (e.g. from seedUserManagementDemoData.ts)
// doesn't also trigger this script's own DB migration as an import side effect —
// only runs when this file is executed directly (`ts-node scripts/migrateDemoUsersToTable.ts`).
if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
