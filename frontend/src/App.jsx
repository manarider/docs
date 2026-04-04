import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/auth-callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/new" element={<DocumentNew />} />
        <Route path="documents/:id" element={<DocumentDetail />} />
        <Route path="documents/:id/edit" element={<DocumentEdit />} />
        <Route path="search" element={<Search />} />
        <Route path="reports" element={<Reports />} />
        <Route path="admin/departments" element={<AdminDepartments />} />
        <Route path="admin/doctypes" element={<AdminDocTypes />} />
        <Route path="admin/audit" element={<AdminAuditLog />} />
        <Route path="admin/trash" element={<AdminTrash />} />
        <Route path="admin/settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/docs">
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
