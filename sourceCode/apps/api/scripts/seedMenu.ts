import 'dotenv/config';
import mongoose from 'mongoose';
import { MenuItemModel } from '../graphQL/menuEntity';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/claim_triage';

const menuItems = [
  {
    id: 'menu-dashboard-001',
    label: 'Dashboard',
    icon: 'dashboard',
    path: '/',
    parentId: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'menu-claim-intake-001',
    label: 'Claims Command Center',
    icon: 'inbox',
    path: '/claim-intake',
    parentId: null,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'menu-field-mapping-001',
    label: 'Field Mapping',
    icon: 'map',
    path: '/field-mapping',
    parentId: null,
    sortOrder: 3,
    isActive: true,
  },
  {
    // Adjuster-type-role-only page (Claims Adjuster / Senior Adjuster / Junior
    // Adjuster) — shows every Supervisor review performed on that adjuster's
    // own overrides. Already live in triage_menus; added here so seedMenu.ts
    // stays the reproducible source of truth for it.
    id: 'menu-claim-supervisor-comments-001',
    label: 'Supervisor Comments',
    icon: 'inbox',
    path: '/claim-supervisor-comments',
    parentId: null,
    sortOrder: 3,
    isActive: true,
  },
  {
    // Was nested under the "Admin" group; "Admin" wrapper removed, so this
    // is now a top-level sidebar group (still shows its own "SERVICE PROVIDER" label).
    id: 'menu-admin-vendor-group',
    label: 'Service Provider',
    icon: 'users',
    path: '/service-provider',
    parentId: null,
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'menu-admin-vendor-management-001',
    label: 'Provider Administration',
    icon: 'vendor',
    path: '/vendor/search',
    parentId: 'menu-admin-vendor-group',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'menu-admin-vendor-onboarding-001',
    label: 'Provider Onboarding',
    icon: 'vendor-onboarding',
    path: '/vendor/onboarding',
    parentId: 'menu-admin-vendor-group',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'menu-admin-vendor-panel-001',
    label: 'Curated Provider Network',
    icon: 'vendor',
    path: '/vendor/panel',
    parentId: 'menu-admin-vendor-group',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'menu-admin-kpi-metrics',
    label: 'Provider Scoreboard',
    icon: 'sigma',
    path: '/service-provider-analytics',
    parentId: 'menu-admin-vendor-group',
    sortOrder: 4,
    isActive: true,
  },
  {
    // Moved under the "Service Provider" group (was top-level under Main).
    id: 'menu-vendor-request-001',
    label: 'Service Provider Request',
    icon: 'vendor',
    path: '/vendor-request/new',
    parentId: 'menu-admin-vendor-group',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'menu-service-request-role-001',
    label: 'Claims Orchestration Engine',
    icon: 'service-request-role',
    path: '/service-request-role',
    parentId: null,
    sortOrder: 3,
    isActive: true,
  },
  {
    // Deliberately NOT nested under menu-admin-vendor-group: this page is
    // reached only via the sidebar, not the Service Provider tab bar
    // (ServiceProviderTabs.tsx) — a standalone top-level entry instead.
    id: 'menu-admin-analytics-insight-001',
    label: 'Service metrics configuration',
    icon: 'vendor',
    path: '/admin/kpi-matrics',
    parentId: null,
    sortOrder: 6,
    isActive: true,
  },

  // ── Vendor Portal (vendor-facing nav, loaded by VendorPortalShell) ──────────
  {
    id: 'menu-group-vendor-portal',
    label: 'Service Provider Portal',
    icon: '',
    path: '',
    parentId: null,
    sortOrder: 99,
    isActive: true,
  },
  {
    id: 'menu-vendor-portal-onboarding',
    label: 'Onboarding',
    icon: 'portal-onboarding',
    path: '/vendor/portal/onboarding',
    parentId: 'menu-group-vendor-portal',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'menu-vendor-portal-profile',
    label: 'Profile',
    icon: 'portal-profile',
    path: '/vendor/portal/profile',
    parentId: 'menu-group-vendor-portal',
    sortOrder: 2,
    isActive: true,
  },

  // ── Active Vendor Portal (active vendor-facing nav, loaded by ActiveVendorShell) ──
  {
    id: 'menu-group-active-vendor-portal',
    label: 'Active Service Provider Portal',
    icon: '',
    path: '',
    parentId: null,
    sortOrder: 100,
    isActive: true,
  },
  {
    id: 'menu-active-vendor-performance',
    label: 'Client Management',
    icon: 'portal-performance',
    path: '/vendor/active/clients',
    parentId: 'menu-group-active-vendor-portal',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'menu-active-vendor-documents',
    label: 'Documents',
    icon: 'portal-documents',
    path: '/vendor/active',
    parentId: 'menu-group-active-vendor-portal',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'menu-active-vendor-profile',
    label: 'Profile',
    icon: 'portal-profile',
    path: '/vendor/active',
    parentId: 'menu-group-active-vendor-portal',
    sortOrder: 4,
    isActive: true,
  },
];

const removedMenuIds = [
  'menu-group-vendors',
  'menu-vendor-search-001',
  'menu-vendor-onboarding-001',
  'menu-vendor-portal-overview',
  'menu-analytics-001',
  // "Main" and "Admin" wrapper groups removed — their children are now
  // top-level sidebar items/groups (see menuItems above).
  'menu-group-main',
  'menu-admin-group',
];

async function seed(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  for (const item of menuItems) {
    await MenuItemModel.findOneAndUpdate(
      { id: item.id },
      item,
      { upsert: true, new: true }
    );
    console.log(`Upserted: ${item.label}`);
  }

  for (const id of removedMenuIds) {
    const result = await MenuItemModel.deleteOne({ id });
    if (result.deletedCount) console.log(`Removed: ${id}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
