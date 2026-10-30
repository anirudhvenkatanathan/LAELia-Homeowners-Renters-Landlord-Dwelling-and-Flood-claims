import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { LoginUserModel, LoginRoleModel, LoginUserAccessModel } from '../graphQL/loginEntity';
import { ADJUSTER_MENU_IDS } from './migrateDemoUsersToTable';

// One-time seed for the User Management feature: creates the Senior Adjuster /
// Junior Adjuster roles and 4 sample users, granting them the exact same menu
// access as the existing Claims Adjuster role (ADJUSTER_MENU_IDS, imported so
// there's a single source of truth — never re-declare a permission set here).
// Idempotent: only creates records that don't already exist, never overwrites.
// Does not touch demo_users/seedLoginData.ts — that collection is specifically
// for the Login page's Quick Login buttons, which stay at 3 (Admin/Claims
// Adjuster/Claims Supervisor).

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';
const DEMO_PASSWORD = 'adjuster@123'; // consistent with the existing admin@123 / client@123 convention

const NEW_ROLES = [
  { roleName: 'Senior Adjuster', roleDescription: 'Senior Claims Adjuster' },
  { roleName: 'Junior Adjuster', roleDescription: 'Junior Claims Adjuster' },
];

const DEMO_USERS = [
  { loginId: 'senior-adjuster-login-001', fullName: 'Sarah Mitchell', username: 'sarah.mitchell', roleName: 'Senior Adjuster' },
  { loginId: 'senior-adjuster-login-002', fullName: 'James Okoro',    username: 'james.okoro',    roleName: 'Senior Adjuster' },
  { loginId: 'junior-adjuster-login-001', fullName: 'Priya Nair',     username: 'priya.nair',     roleName: 'Junior Adjuster' },
  { loginId: 'junior-adjuster-login-002', fullName: 'Derek Chan',     username: 'derek.chan',     roleName: 'Junior Adjuster' },
];

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // ── Seed Roles ──────────────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {};
  for (const r of NEW_ROLES) {
    const existing = await LoginRoleModel.findOne({ roleName: r.roleName }).lean();
    if (!existing) {
      const roleId = uuidv4();
      await LoginRoleModel.create({ roleId, ...r, createdBy: 'system', updatedBy: 'system' });
      roleMap[r.roleName] = roleId;
      console.log(`Created role: ${r.roleName}`);
    } else {
      roleMap[r.roleName] = existing.roleId;
      console.log(`Role exists: ${r.roleName}`);
    }
  }

  // ── Seed Users + Access Grants ──────────────────────────────────────────────
  for (const u of DEMO_USERS) {
    const email = `${u.username}@laelia.com`;
    const existing = await LoginUserModel.findOne({ loginId: u.loginId }).lean();
    if (!existing) {
      const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
      await LoginUserModel.create({
        loginId: u.loginId, email, username: u.username, password: hashed,
        fullName: u.fullName, status: 'Active', isActive: true,
        createdBy: 'system', updatedBy: 'system',
      });
      console.log(`Created user: ${email} / ${DEMO_PASSWORD}`);
    } else {
      console.log(`User exists: ${email}`);
    }

    // Per-menuId upsert (not per-user existence) — idempotent AND incremental,
    // so re-running this script after ADJUSTER_MENU_IDS gains a new entry
    // grants just the missing menuId to already-seeded users instead of
    // skipping them entirely.
    const roleId = roleMap[u.roleName];
    let grantedCount = 0;
    for (const menuId of ADJUSTER_MENU_IDS) {
      const existingGrant = await LoginUserAccessModel.findOne({ loginId: u.loginId, menuId }).lean();
      if (existingGrant) continue;
      await LoginUserAccessModel.create({
        loginUserAccessId: uuidv4(),
        loginId: u.loginId, roleId, menuId,
        createdBy: 'system', updatedBy: 'system',
      });
      grantedCount++;
    }
    console.log(grantedCount > 0 ? `Granted ${email} access to ${grantedCount} new menu item(s)` : `Access already granted: ${email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
