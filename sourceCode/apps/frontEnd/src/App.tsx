import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useMenu } from './hooks/menu/useMenu';

const OverviewRedirect: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  return <Navigate to={`/vendor/portal/onboarding/${vendorId ?? ''}`} replace />;
};

// Redirects to the first accessible menu path when the user doesn't have Dashboard access.
const HomeRoute: React.FC = () => {
  const { user }          = useAuth();
  const { items, loading } = useMenu();

  if (loading || !user) return <DashboardMaster />;

  const menuIdSet    = new Set(user.menuIds);
  const hasDashboard = items.some((item) => menuIdSet.has(item.id) && item.path === '/');

  if (hasDashboard) return <DashboardMaster />;

  const first = items
    .filter((item) => menuIdSet.has(item.id) && item.path && item.path !== '/')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];

  return first ? <Navigate to={first.path} replace /> : <DashboardMaster />;
};
import DashboardMaster              from './pages/Dashboard/DashboardMaster';
import ClaimIntakeMaster             from './pages/ClaimIntake/claimIntakeMaster';
import ClaimIntakeDetails            from './pages/ClaimIntake/claimIntakeDetails';
import SupervisorComments            from './pages/ClaimIntake/SupervisorComments';
import FieldMappingMaster            from './pages/FieldMapping/FieldMappingMaster';
import FieldMappingDetails           from './pages/FieldMapping/FieldMappingDetails';
import ServiceRequestRoleMaster      from './pages/ServiceRequestRole/ServiceRequestRoleMaster';
import ServiceRequestRoleDetails     from './pages/ServiceRequestRole/ServiceRequestRoleDetails';
import ServiceRequestRoleCreate      from './pages/ServiceRequestRole/ServiceRequestRoleCreate';
import VendorSearch                  from './pages/Vendor/VendorSearch';
import VendorPanel                   from './pages/Vendor/VendorPanel';
import VendorOnboardingSearch         from './pages/VendorOnboarding/VendorOnboardingSearch';
import VendorOnboardingDetails        from './pages/VendorOnboarding/VendorOnboardingDetails';
import VendorOnboardingPendingApproval from './pages/VendorOnboarding/VendorOnboardingPendingApproval';
import VendorRequestMaster           from './pages/VendorRequest/VendorRequestMaster';
import VendorRequestForm             from './pages/VendorRequest/VendorRequestForm';
import VendorRequestDetails          from './pages/VendorRequest/VendorRequestDetails';
import KpiMetrics                    from './pages/Admin/KpiMetrics';
import VendorSelectionLogicMaster    from './pages/VendorSelectionLogic/VendorSelectionLogicMaster';
import VendorSelectionLogicDetail    from './pages/VendorSelectionLogic/VendorSelectionLogicDetail';
import VendorSelectionLogicForm      from './pages/VendorSelectionLogic/VendorSelectionLogicForm';
import LoginPage                     from './pages/Login';
import VendorSignupPage              from './pages/VendorSignup';
import VendorProfile                 from './pages/VendorPortal/VendorProfile';
import VendorOnboardingPortal        from './pages/VendorPortal/VendorOnboarding';
import ClientManagement               from './pages/VendorPortal/ClientManagement';
import MyPerformance                 from './pages/VendorPortal/MyPerformance';
import MyDocuments                   from './pages/VendorPortal/MyDocuments';
import MyProfile                     from './pages/VendorPortal/MyProfile';
import AnalyticsInsights             from './pages/Analytics/AnalyticsInsights';
import ServiceProviderLanding        from './pages/ServiceProvider/ServiceProviderLanding';
import ServiceProviderAnalytics      from './pages/ServiceProvider/ServiceProviderAnalytics';
import ServiceProviderPortal         from './pages/Dev/ServiceProviderPortal';
import ProtectedRoute                from './components/layout/ProtectedRoute';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/vendor-signup" element={<VendorSignupPage />} />
        <Route path="/dev/service-provider" element={<ServiceProviderPortal />} />
        <Route path="/"                                          element={<ProtectedRoute><HomeRoute /></ProtectedRoute>} />
        <Route path="/analytics-insight"                         element={<ProtectedRoute><AnalyticsInsights /></ProtectedRoute>} />
        <Route path="/claim-intake"                              element={<ProtectedRoute><ClaimIntakeMaster /></ProtectedRoute>} />
        <Route path="/claim-intake/details/:uploadId"            element={<ProtectedRoute><ClaimIntakeDetails /></ProtectedRoute>} />
        <Route path="/claim-supervisor-comments"                 element={<ProtectedRoute><SupervisorComments /></ProtectedRoute>} />
        <Route path="/field-mapping"                             element={<ProtectedRoute><FieldMappingMaster /></ProtectedRoute>} />
        <Route path="/field-mapping/details/:uploadId"           element={<ProtectedRoute><FieldMappingDetails /></ProtectedRoute>} />
        <Route path="/service-request-role"                      element={<ProtectedRoute><ServiceRequestRoleMaster /></ProtectedRoute>} />
        <Route path="/service-request-role/create"               element={<ProtectedRoute><ServiceRequestRoleCreate /></ProtectedRoute>} />
        <Route path="/service-request-role/details/:uploadId"    element={<ProtectedRoute><ServiceRequestRoleDetails /></ProtectedRoute>} />
        <Route path="/vendor-request"                            element={<ProtectedRoute><VendorRequestMaster /></ProtectedRoute>} />
        <Route path="/vendor-request/new"                        element={<ProtectedRoute><VendorRequestForm /></ProtectedRoute>} />
        <Route path="/vendor-request/:id"                        element={<ProtectedRoute><VendorRequestDetails /></ProtectedRoute>} />
        <Route path="/vendor/panel"                              element={<ProtectedRoute><VendorPanel /></ProtectedRoute>} />
        <Route path="/service-provider"                          element={<ProtectedRoute><ServiceProviderLanding /></ProtectedRoute>} />
        <Route path="/service-provider-analytics"                element={<ProtectedRoute><ServiceProviderAnalytics /></ProtectedRoute>} />
        <Route path="/vendor"                                    element={<Navigate to="/vendor/search" replace />} />
        <Route path="/vendor/search"                             element={<ProtectedRoute><VendorSearch /></ProtectedRoute>} />
        <Route path="/vendor/onboarding"                         element={<ProtectedRoute><VendorOnboardingSearch /></ProtectedRoute>} />
        <Route path="/vendor/onboarding/pending/:vendorId"       element={<ProtectedRoute><VendorOnboardingPendingApproval /></ProtectedRoute>} />
        <Route path="/vendor/onboarding/details/:vendorId"       element={<ProtectedRoute><VendorOnboardingDetails /></ProtectedRoute>} />
        <Route path="/vendor/portal/overview/:vendorId"           element={<OverviewRedirect />} />
        <Route path="/vendor/portal/onboarding/:vendorId"         element={<ProtectedRoute><VendorOnboardingPortal /></ProtectedRoute>} />
        <Route path="/vendor/portal/profile/:vendorId"            element={<ProtectedRoute><VendorProfile /></ProtectedRoute>} />
        <Route path="/vendors/active/clients/:vendorId"             element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
        <Route path="/vendors/active/performance/:vendorId"        element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
        <Route path="/vendors/active/documents/:vendorId"          element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
        <Route path="/vendors/active/profile/:vendorId"            element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
        <Route path="/admin/kpi-matrics"                         element={<ProtectedRoute><KpiMetrics /></ProtectedRoute>} />
        <Route path="/vendor/vendor-selection-logic"               element={<ProtectedRoute><VendorSelectionLogicMaster /></ProtectedRoute>} />
        <Route path="/vendor/vendor-selection-logic/new"           element={<ProtectedRoute><VendorSelectionLogicForm /></ProtectedRoute>} />
        <Route path="/vendor/vendor-selection-logic/:ruleId"       element={<ProtectedRoute><VendorSelectionLogicDetail /></ProtectedRoute>} />
        <Route path="/vendor/vendor-selection-logic/:ruleId/edit"  element={<ProtectedRoute><VendorSelectionLogicForm /></ProtectedRoute>} />
        <Route path="*"                                          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
