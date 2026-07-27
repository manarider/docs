import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

const ROLE_LABEL = {
  contractor: 'ผู้รับจ้าง',
  supervisor: 'ผู้ควบคุมงาน',
  project_manager: 'ผู้จัดการโครงการ',
};

export default function ProjectKeyLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultProjectId = searchParams.get('projectId') || '';

  const [form, setForm] = useState({ key: '', project_id: defaultProjectId });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectInfo, setProjectInfo] = useState(null);

  useEffect(() => {
    if (!defaultProjectId) return;
    api.get(`/project-auth/project/${defaultProjectId}/info`)
      .then(({ data }) => setProjectInfo(data.data))
      .catch(() => {});
  }, [defaultProjectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.key.trim()) { setError('กรุณาระบุ KEY'); return; }
    if (!form.project_id.trim()) { setError('กรุณาระบุรหัสโครงการ'); return; }

    setLoading(true);
    try {
      const { data } = await api.post('/project-auth/login', {
        key: form.key.trim(),
        project_id: form.project_id.trim(),
      });
      toast.success(`ยินดีต้อนรับ ${ROLE_LABEL[data.data.role] || data.data.role}: ${data.data.label}`);
      navigate(`/projects/${data.data.projectId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">ระบบติดตามโครงการ</h1>
          <p className="text-sm text-gray-500 mt-1">เข้าสู่ระบบด้วย KEY สำหรับผู้ปฏิบัติงาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!defaultProjectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสโครงการ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                placeholder="ระบุรหัสโครงการที่ได้รับ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          {defaultProjectId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
              {projectInfo ? (
                <>
                  <p className="font-semibold text-base text-gray-800">{projectInfo.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{projectInfo.dept} · ปีงบ {projectInfo.fiscal_year}</p>
                  {projectInfo.status === 'closed' && (
                    <p className="text-xs text-red-600 mt-1 font-medium">⚠ โครงการนี้ปิดแล้ว</p>
                  )}
                </>
              ) : (
                <span className="font-mono text-xs">{defaultProjectId}</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KEY เข้าใช้งาน <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="วาง KEY ที่ได้รับจากผู้ดูแลโครงการ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg text-base font-medium hover:bg-orange-600 disabled:opacity-50 transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังตรวจสอบ...
              </span>
            ) : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">KEY หมดอายุ? ติดต่อผู้ดูแลโครงการเพื่อต่ออายุ</p>
        </div>
      </div>
    </div>
  );
}
