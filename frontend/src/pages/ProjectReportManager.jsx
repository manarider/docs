import { useState, useEffect } from 'react';
import { Link, useParams, useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SOURCE_MODULES = [
  {
    id: 'daily_report',
    title: 'บันทึกรายงานประจำวัน',
    description: 'สร้างรายงานจากวันที่รายงาน สถานที่ รายละเอียดภาคเช้า/บ่าย รูปถ่าย และรายการครุภัณฑ์',
    fields: ['วันที่รายงาน', 'สถานที่', 'รายละเอียดงาน', 'รูปถ่าย', 'ครุภัณฑ์'],
  },
  {
    id: 'procurement',
    title: 'บันทึกการรับพัสดุ',
    description: 'สร้างรายงานจากรายการรับเข้า ประเภทพัสดุ จำนวน หมายเลขครุภัณฑ์ การเบิกจ่าย และรูปตรวจรับ',
    fields: ['วันที่รับ', 'ประเภท', 'จำนวน', 'คงเหลือ', 'หมายเลขครุภัณฑ์'],
  },
  {
    id: 'acceptance',
    title: 'บันทึกการตรวจรับ',
    description: 'สร้างรายงานจากผลการตรวจรับ หมายเหตุ เอกสารส่งมอบ และภาพถ่ายประกอบการตรวจรับงาน',
    fields: ['วันที่ตรวจรับ', 'หมายเหตุ', 'เอกสารส่งมอบ', 'รูปตรวจรับ', 'ผู้บันทึก'],
  },
];

const WORKFLOW_STEPS = [
  'สร้าง template และเลือกแหล่งข้อมูล',
  'อัปโหลดแบบฟอร์ม PDF/รูปภาพเป็นพื้นหลัง',
  'ลาก field ไปวางบนตำแหน่งเอกสาร',
  'เลือก record จริงเพื่อ preview/print/download',
];

export default function ProjectReportManager() {
  const { projectId } = useParams();
  const { project, isInternal, canManageKeys } = useOutletContext();
  const canManageTemplates = isInternal && canManageKeys;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [projectId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/report-templates`);
      setTemplates(data.data || []);
    } catch (err) {
      toast.error('โหลด template ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (templateId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/projects/${projectId}/report-templates/${templateId}`, { status: newStatus });
      toast.success(newStatus === 'active' ? 'เปิดใช้งาน template แล้ว' : 'ปิดการใช้งาน template แล้ว');
      loadTemplates();
    } catch (err) {
      toast.error('ปรับปรุงสถานะไม่สำเร็จ');
    }
  };

  const handleToggleScope = async (templateId, currentScope) => {
    const newScope = currentScope === 'global' ? 'project' : 'global';
    const confirmMsg =
      newScope === 'global'
        ? 'แปลง template นี้เป็น Global เพื่อให้ทุกโครงการใช้งานร่วมกันหรือไม่?'
        : 'แปลง template นี้กลับเป็นของโครงการนี้เท่านั้นหรือไม่?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.put(`/projects/${projectId}/report-templates/${templateId}`, { scope: newScope });
      toast.success(newScope === 'global' ? 'แปลงเป็น Global แล้ว' : 'แปลงเป็นของโครงการนี้แล้ว');
      loadTemplates();
    } catch (err) {
      toast.error('ปรับปรุง scope ไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-primary tracking-wide">REPORT MANAGER</p>
            <h2 className="text-xl font-bold text-gray-800 mt-1">ระบบจัดการรายงาน</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              ศูนย์กลางสำหรับสร้าง template รายงานจากข้อมูลบันทึกต่าง ๆ ของโครงการ โดยแยกการออกแบบเอกสารออกจากหน้าบันทึกข้อมูล
            </p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium self-start ${canManageTemplates ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {canManageTemplates ? 'จัดการ template ได้' : 'ดูและสร้างรายงานได้'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
            <p className="text-xs text-orange-700 font-medium">โครงการ</p>
            <p className="font-semibold text-gray-800 mt-1 line-clamp-2">{project?.title}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium">ปีงบประมาณ</p>
            <p className="font-semibold text-gray-800 mt-1">{project?.fiscal_year || '-'}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-medium">สถานะระบบ</p>
            <p className="font-semibold text-gray-800 mt-1">เตรียมใช้งาน template designer</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-800">รายการ Template</h3>
                <p className="text-xs text-gray-500 mt-1">Template ที่สร้างแล้วในโครงการนี้</p>
              </div>
              {canManageTemplates && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-sm bg-primary text-white rounded-lg px-4 py-2 hover:bg-orange-600"
                >
                  + สร้าง Template
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">กำลังโหลด...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">ยังไม่มี template</p>
                {canManageTemplates && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3 text-sm text-primary hover:underline"
                  >
                    สร้าง template แรก
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    className="border border-gray-100 rounded-lg p-4 hover:border-orange-200 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800">{tpl.name}</h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${tpl.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                              }`}
                          >
                            {tpl.status === 'active' ? 'ใช้งาน' : 'ปิด'}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mt-2">
                          <span>Module: {tpl.module}</span>
                          <span>Scope: {tpl.scope}</span>
                          <span>{tpl.pages?.length || 0} หน้า</span>
                        </div>
                      </div>
                      {canManageTemplates && (
                        <div className="flex items-center gap-3">
                          {canManageTemplates && (
                            <button
                              onClick={() => handleToggleScope(tpl._id, tpl.scope)}
                              className={`text-xs border px-2.5 py-1.5 rounded transition font-semibold shadow-sm ${tpl.scope === 'global'
                                  ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                  : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                                }`}
                            >
                              {tpl.scope === 'global' ? 'ยกเลิก Global' : 'แปลงเป็น Global'}
                            </button>
                          )}
                          {canManageTemplates && (
                            <button
                              onClick={() => handleToggleStatus(tpl._id, tpl.status)}
                              className={`text-xs border px-2.5 py-1.5 rounded transition font-semibold shadow-sm ${tpl.status === 'active'
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-green-200 text-green-600 hover:bg-green-50'
                                }`}
                            >
                              {tpl.status === 'active' ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                            </button>
                          )}
                          {canManageTemplates && (
                            <Link
                              to={`/projects/${projectId}/report-manager/${tpl._id}/designer`}
                              className="text-sm text-primary hover:underline font-semibold bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 hover:bg-gray-100 transition shadow-sm"
                            >
                              แก้ไข Designer
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-800">แหล่งข้อมูลรายงาน</h3>
                <p className="text-xs text-gray-500 mt-1">ข้อมูลชุดแรกที่จะรองรับใน report template</p>
              </div>
            </div>

            <div className="space-y-3">
              {SOURCE_MODULES.map((source) => (
                <div key={source.id} className="border border-gray-100 rounded-lg p-4 hover:border-orange-200 transition">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">{source.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{source.description}</p>
                    </div>
                    <span className="text-[11px] uppercase text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 self-start">
                      {source.id}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {source.fields.map((field) => (
                      <span key={field} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-gray-800">ขั้นตอนทำงาน</h3>
            <ol className="mt-4 space-y-3">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-gray-600">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-gray-800">สถานะการพัฒนา</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">ถอด PDF เดิมจากหน้าบันทึก</span>
                <span className="text-green-600 font-medium">เสร็จแล้ว</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">หน้า Report Manager</span>
                <span className="text-green-600 font-medium">พร้อมใช้</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">Template CRUD / Designer</span>
                <span className="text-amber-600 font-medium">ขั้นถัดไป</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-gray-800">เริ่มจากข้อมูลจริงของโครงการ</h3>
          <p className="text-sm text-gray-500 mt-1">เลือกดูบันทึกต้นทางก่อนสร้าง template หรือ preview รายงาน</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/projects/${projectId}/daily-reports`} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">รายงานประจำวัน</Link>
          <Link to={`/projects/${projectId}/procurement`} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">พัสดุ</Link>
          <Link to={`/projects/${projectId}/acceptance`} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">ตรวจรับงาน</Link>
        </div>
      </div>

      {showCreateModal && (
        <CreateTemplateModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [module, setModule] = useState('daily_report');
  const [scope, setScope] = useState('project');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('กรุณาระบุชื่อ template');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/report-templates`, { name, module, scope });
      toast.success('สร้าง template แล้ว');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'สร้าง template ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">สร้าง Template ใหม่</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ Template <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="เช่น รายงานประจำวัน แบบ ก."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="daily_report">บันทึกรายงานประจำวัน</option>
              <option value="procurement">บันทึกการรับพัสดุ</option>
              <option value="acceptance">บันทึกการตรวจรับ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="project">โครงการนี้เท่านั้น</option>
              <option value="global">ใช้ได้ทุกโครงการ (Global)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm bg-primary text-white rounded-lg px-4 py-2 hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'สร้าง Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}