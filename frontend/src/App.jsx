import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectAuthProvider } from './contexts/ProjectAuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Documents from './pages/Documents';
import DocumentNew from './pages/DocumentNew';
import DocumentDetail from './pages/DocumentDetail';
import DocumentEdit from './pages/DocumentEdit';
import Search from './pages/Search';
import Reports from './pages/Reports';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AdminDepartments from './pages/AdminDepartments';
import AdminDocTypes from './pages/AdminDocTypes';
import AdminAuditLog from './pages/AdminAuditLog';
import AdminTrash from './pages/AdminTrash';
import AdminSettings from './pages/AdminSettings';
import PublicDownload from './pages/PublicDownload';
import ProjectKeyLogin from './pages/ProjectKeyLogin';
import ProjectTracker from './pages/ProjectTracker';
import ProjectOverview from './pages/ProjectOverview';
import ProjectDailyReports from './pages/ProjectDailyReports';
import ProjectProcurement from './pages/ProjectProcurement';
import ProjectAcceptance from './pages/ProjectAcceptance';
import ProjectKeyManager from './pages/ProjectKeyManager';
import EquipmentSearch from './pages/EquipmentSearch';
import ProjectReportManager from './pages/ProjectReportManager';
import TemplateDesigner from './pages/TemplateDesigner';
import OutsourcedGroups from './pages/OutsourcedGroups';
import OutsourcedForms from './pages/OutsourcedForms';
import OutsourcedReports from './pages/OutsourcedReports';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public — ไม่ต้อง login */}
      <Route path="/download/:token" element={<PublicDownload />} />
      <Route path="/project-access" element={<ProjectKeyLogin />} />

      {/* Project Tracker — accessible to both internal and KEY users */}
      <Route path="/projects/:projectId" element={<ProjectTracker />}>
        <Route index element={<ProjectOverview />} />
        <Route path="daily-reports" element={<ProjectDailyReports />} />
        <Route path="procurement" element={<ProjectProcurement />} />
        <Route path="acceptance" element={<ProjectAcceptance />} />
        <Route path="report-manager" element={<ProjectReportManager />} />
        <Route path="report-manager/:templateId/designer" element={<TemplateDesigner />} />
        <Route path="keys" element={<ProjectKeyManager />} />
      </Route>

      {!user ? (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth-callback" element={<AuthCallbackPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <>
          <Route path="/auth-callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<Layout />}>
            {user.role === 'outsourced' ? (
              <>
                <Route index element={<Navigate to="/outsourced" replace />} />
                <Route path="outsourced" element={<OutsourcedGroups />} />
                <Route path="outsourced/groups/:groupId/forms" element={<OutsourcedForms />} />
                <Route path="outsourced/groups/:groupId/reports" element={<OutsourcedReports />} />
                <Route path="*" element={<Navigate to="/outsourced" replace />} />
              </>
            ) : (
              <>
                <Route index element={<Home />} />
                <Route path="documents" element={<Documents />} />
                <Route path="documents/new" element={<DocumentNew />} />
                <Route path="documents/:id" element={<DocumentDetail />} />
                <Route path="documents/:id/edit" element={<DocumentEdit />} />
                <Route path="search" element={<Search />} />
                <Route path="reports" element={<Reports />} />
                <Route path="equipment-search" element={<EquipmentSearch />} />
                <Route path="admin/departments" element={<AdminDepartments />} />
                <Route path="admin/doctypes" element={<AdminDocTypes />} />
                <Route path="admin/audit" element={<AdminAuditLog />} />
                <Route path="admin/trash" element={<AdminTrash />} />
                <Route path="admin/settings" element={<AdminSettings />} />
                <Route path="outsourced" element={<OutsourcedGroups />} />
                <Route path="outsourced/groups/:groupId/forms" element={<OutsourcedForms />} />
                <Route path="outsourced/groups/:groupId/reports" element={<OutsourcedReports />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Route>
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/docs">
      <Routes>
        {/* Public route — ไม่ต้องผ่าน AuthProvider เลย */}
        <Route path="/download/:token" element={<PublicDownload />} />
        <Route path="/project-access" element={<ProjectKeyLogin />} />
        {/* ทุก route อื่น → ผ่าน Auth + ProjectAuth */}
        <Route
          path="*"
          element={
            <AuthProvider>
              <ProjectAuthProvider>
                <Toaster position="top-right" />
                <AppRoutes />
              </ProjectAuthProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
