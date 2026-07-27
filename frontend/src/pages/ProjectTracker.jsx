import { useEffect, useState } from 'react';
import { useParams, NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useProjectAuth } from '../contexts/ProjectAuthContext';
import toast from 'react-hot-toast';

const ROLE_LABEL = {
  contractor: 'ผู้รับจ้าง',
  supervisor: 'ผู้ควบคุมงาน',
  project_manager: 'ผู้จัดการโครงการ',
  internal: 'ผู้ใช้ภายใน',
};

const ROLE_COLOR = {
  contractor: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-green-100 text-green-800',
  project_manager: 'bg-purple-100 text-purple-800',
  internal: 'bg-orange-100 text-orange-800',
};

export default function ProjectTracker() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectUser, loading: pkLoading } = useProjectAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // ตรวจสอบ auth
  const isInternal = !!user;
  const isKeyUser = !!projectUser && !isInternal;
  const isAuthed = isInternal || isKeyUser;
  const currentRole = isInternal ? 'internal' : projectUser?.role;
  const canManageKeys = isInternal && ['superadmin', 'admin', 'manager', 'staff'].includes(user?.role);
  // contractor เห็นเฉพาะ overview + daily-reports
  const isContractor = !isInternal && currentRole === 'contractor';
  const CONTRACTOR_ALLOWED = [`/projects/${projectId}`, `/projects/${projectId}/daily-reports`];

  useEffect(() => {
    if (!pkLoading && !isAuthed) {
      navigate(`/project-access?projectId=${projectId}`, { replace: true });
      return;
    }
    // redirect contractor ออกจาก route ที่ไม่มีสิทธิ์
    if (!pkLoading && isAuthed) {
      const path = location.pathname.replace(/\/$/, '');
      const isRestricted = !CONTRACTOR_ALLOWED.some((a) => path === a);
      if (isContractor && isRestricted) {
        navigate(`/projects/${projectId}/daily-reports`, { replace: true });
        return;
      }
    }
    if (!pkLoading) {
      api.get(`/projects/${projectId}`)
        .then(({ data }) => setProject(data.data))
        .catch(() => toast.error('โหลดข้อมูลโครงการไม่สำเร็จ'))
        .finally(() => setLoading(false));
    }
  }, [projectId, pkLoading, isAuthed]);

  if (pkLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const navLinkClass = ({ isActive }) =>
    `px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3 pb-0">

          {/* System title + role */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary tracking-wide">📋 ระบบติดตามโครงการ</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[currentRole] || 'bg-gray-100 text-gray-700'}`}>
                {ROLE_LABEL[currentRole] || currentRole}
                {isKeyUser && projectUser?.label && ` · ${projectUser.label}`}
              </span>
              {isKeyUser && (
                <button
                  onClick={async () => { await api.post('/project-auth/logout'); navigate('/project-access'); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition px-1 py-1"
                >ออก</button>
              )}
            </div>
          </div>

          {/* Project name */}
          <div className="mb-1">
            {isInternal && (
              <Link to={`/documents/${project.document_id}`} className="text-xs text-primary hover:underline">
                ← กลับเอกสาร
              </Link>
            )}
            <div className="flex items-start gap-2 mt-0.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-gray-800 leading-snug">{project.title}</h1>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                }`}>
                {project.status === 'active' ? 'กำลังดำเนินการ' : 'ปิดแล้ว'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{project.dept_id?.name} · ปีงบ {project.fiscal_year}</p>
          </div>

          {/* Tabs */}
          <div className="flex -mb-px overflow-x-auto mt-3">
            <NavLink to="" end className={navLinkClass}>ภาพรวม</NavLink>
            <NavLink to="daily-reports" className={navLinkClass}>รายงานประจำวัน</NavLink>
            {!isContractor && <NavLink to="procurement" className={navLinkClass}>พัสดุ</NavLink>}
            {!isContractor && <NavLink to="acceptance" className={navLinkClass}>ตรวจรับงาน</NavLink>}
            {!isContractor && <NavLink to="report-manager" className={navLinkClass}>ระบบจัดการรายงาน</NavLink>}
            {canManageKeys && <NavLink to="keys" className={navLinkClass}>จัดการ KEY</NavLink>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet context={{ project, setProject, currentRole, isKeyUser, isInternal, canManageKeys }} />
      </div>
    </div>
  );
}
