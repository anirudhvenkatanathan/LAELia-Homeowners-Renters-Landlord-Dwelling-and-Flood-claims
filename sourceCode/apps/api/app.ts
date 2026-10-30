import express from 'express';
import { ApolloServer } from 'apollo-server-express';
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

/**
 * Builds the Express app (REST + GraphQL). Pure construction: it does not connect to
 * MongoDB, seed, or listen, so it can be reused by the local server and the Netlify function.
 */
export async function createApp(): Promise<express.Express> {
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

  return app;
}
