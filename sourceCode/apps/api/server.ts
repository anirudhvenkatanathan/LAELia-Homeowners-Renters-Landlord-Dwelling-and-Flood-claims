import 'dotenv/config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import mongoose from 'mongoose';
import { typeDefs, resolvers } from './graphQL/claimIntakeEntity';
import { menuTypeDefs, menuResolvers } from './graphQL/menuEntity';
import { fieldMappingTypeDefs, fieldMappingResolvers } from './graphQL/fieldMappingEntity';
import { serviceRequestRoleTypeDefs, serviceRequestRoleResolvers } from './graphQL/serviceRequestRoleEntity';
import { vendorTypeDefs, vendorResolvers } from './graphQL/vendorEntity';
import { vendorSelectionLogicTypeDefs, vendorSelectionLogicResolvers } from './graphQL/vendorSelectionLogicEntity';
import { loginTypeDefs, loginResolvers } from './graphQL/loginEntity';
import claimIntakeMasterRoutes  from './routes/claimIntakeMasterRoutes';
import fieldMappingMasterRoutes from './routes/fieldMappingMasterRoutes';
import templateRoutes           from './routes/templateRoutes';
import vendorOnboardingRoutes   from './routes/vendorOnboardingRoutes';
import aiSummaryRoutes          from './routes/aiSummaryRoutes';
import kpiMetricsRoutes         from './routes/kpiMetricsRoutes';
import vendorServiceRequestRoutes from './routes/vendorServiceRequestRoutes';
import activeVendorRoutes         from './routes/activeVendorRoutes';
import { MenuItemModel }        from './graphQL/menuEntity';
import { ensureServiceRequestRoleLOB } from './services/serviceRequestRoleLOBBackfill';
import { seedFromExportIfEmpty } from './services/seedFromExport';
import path from 'path';
import fs from 'fs';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const MONGO_URI = process.env.MONGO_URI ?? '';

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set. Exiting.');
  process.exit(1);
}

async function seedActiveVendorMenus(): Promise<void> {
  const groupId = 'menu-group-active-vendor-portal';

  const items = [
    { id: groupId,                          label: 'Active Vendor Portal', icon: '',                   path: '',                        parentId: null,    sortOrder: 100, isActive: true },
    { id: 'menu-active-vendor-performance', label: 'Client Management',    icon: 'portal-performance',  path: '/vendors/active/clients',  parentId: groupId, sortOrder: 2,   isActive: true },
    { id: 'menu-active-vendor-documents',   label: 'My Documents',          icon: 'portal-documents',    path: '/vendors/active/documents', parentId: groupId, sortOrder: 3,   isActive: true },
    { id: 'menu-active-vendor-profile',     label: 'My Profile',            icon: 'portal-profile',      path: '/vendors/active/profile',   parentId: groupId, sortOrder: 4,   isActive: true },
  ];

  for (const item of items) {
    await MenuItemModel.updateOne(
      { id: item.id },
      { $setOnInsert: item },
      { upsert: true },
    );
  }
  console.log('Active Vendor Portal menus ensured.');
}

async function bootstrap(): Promise<void> {
  // Connect to MongoDB
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // First deploy only: load seed/ClaimDB into an empty database (SEED_ON_EMPTY=true)
  await seedFromExportIfEmpty();

  // Seed Active Vendor Portal menu items if not present
  await seedActiveVendorMenus();

  // Backfill lineOfBusiness on any service_request_role record that predates
  // it — runs in every environment on every startup, so a fresh deploy's DB
  // self-heals without a manual migration step.
  await ensureServiceRequestRoleLOB();

  const app = express();
  app.disable('etag');

  // Body parsing middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS for local development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Every API response must always reflect the latest data — disable all caching.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // REST routes
  app.use('/api/claim-intake',       claimIntakeMasterRoutes);
  app.use('/api/field-mapping',      fieldMappingMasterRoutes);
  app.use('/api/templates',          templateRoutes);
  app.use('/api/vendors/onboarding', vendorOnboardingRoutes);
  app.use('/api/ai',                 aiSummaryRoutes);
  app.use('/api/admin/kpi-metrics',  kpiMetricsRoutes);
  app.use('/api/vendor-service-requests', vendorServiceRequestRoutes);
  app.use('/api/vendors/active',          activeVendorRoutes);

  // Apollo Server (GraphQL)
  const server = new ApolloServer({
    typeDefs: [typeDefs, menuTypeDefs, fieldMappingTypeDefs, serviceRequestRoleTypeDefs, vendorTypeDefs, vendorSelectionLogicTypeDefs, loginTypeDefs],
    resolvers: [resolvers, menuResolvers, fieldMappingResolvers, serviceRequestRoleResolvers, vendorResolvers, vendorSelectionLogicResolvers, loginResolvers],
    context: ({ req }) => ({ req }),
  });

  await server.start();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.applyMiddleware({ app: app as any, path: '/graphql' });

  // Hosted mode: serve the built React app from the same origin as the API.
  // Skipped automatically in local dev when the frontend hasn't been built.
  const frontendDist = process.env['FRONTEND_DIST']
    ?? path.resolve(__dirname, __dirname.endsWith('dist') ? '../../frontEnd/dist' : '../frontEnd/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    // SPA fallback: any non-API GET returns index.html so client-side routes work on refresh
    app.get(/^(?!\/api\/|\/graphql).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
    console.log(`Serving frontend from ${frontendDist}`);
  }

  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
