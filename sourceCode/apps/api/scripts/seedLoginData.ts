import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { LoginUserModel, LoginRoleModel, LoginUserAccessModel, DemoUserModel } from '../graphQL/loginEntity';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

const ROLES = [
  { roleName: 'Admin',            roleDescription: 'Full system access' },
  { roleName: 'Claims Supervisor', roleDescription: 'Manage claims and assignments' },
  { roleName: 'Claims Adjuster',  roleDescription: 'Adjust and process claims' },
  { roleName: 'Vendor Manager',   roleDescription: 'Manage vendor onboarding and selection' },
  { roleName: 'Vendor User',      roleDescription: 'Vendor-facing user' },
  { roleName: 'Read Only User',   roleDescription: 'View-only access' },
];

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // ── Seed Roles ──────────────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {};
  for (const r of ROLES) {
    let existing = await LoginRoleModel.findOne({ roleName: r.roleName }).lean();
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

  // ── Seed Demo Users (mirrors QUICK_LOGINS in frontEnd/src/pages/Login/index.tsx) ─
  // Sourced entirely from the demo_users table — run
  // scripts/migrateDemoUsersToTable.ts first to populate it.
  const DEMO_USERS = await DemoUserModel.find().lean();
  if (DEMO_USERS.length === 0) {
    console.warn('No records found in demo_users. Run scripts/migrateDemoUsersToTable.ts first, then re-run this script.');
  }

  for (const u of DEMO_USERS) {
    const existing = await LoginUserModel.findOne({ loginId: u.loginId }).lean();
    if (!existing) {
      const hashed = await bcrypt.hash(u.password, 10);
      await LoginUserModel.create({
        loginId:  u.loginId,
        email:    u.email,
        username: u.username,
        password: hashed,
        fullName: u.fullName ?? '',
        createdBy: 'system', updatedBy: 'system',
      });
      console.log(`Created user: ${u.email} / ${u.password}`);
    } else {
      console.log(`User exists: ${u.email}`);
    }

    // Grant access to this role's menus only (remove stale records first)
    await LoginUserAccessModel.deleteMany({ loginId: u.loginId });
    const roleId = roleMap[u.roleName];
    for (const menuId of u.menuIds) {
      await LoginUserAccessModel.create({
        loginUserAccessId: uuidv4(),
        loginId:  u.loginId,
        roleId,
        menuId,
        createdBy: 'system', updatedBy: 'system',
      });
    }
    console.log(`Granted ${u.email} access to ${u.menuIds.length} menu items`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
