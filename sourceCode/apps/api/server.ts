import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { MenuItemModel } from './graphQL/menuEntity';
import { createApp } from './app';
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

  // Seed Active Vendor Portal menu items if not present
  await seedActiveVendorMenus();

  const app = await createApp();

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
