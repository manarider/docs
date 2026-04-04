import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const ACCEPT = '.pdf';

function emptyFile() {
  return { sub_title: '', file: null };
}

export default function DocumentNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [depts, setDepts] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dept_id: '',
    type_id: '',
    tags: '',
  });
  const [files, setFiles] = useState([emptyFile()]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null | { current, total, name }
  const blockNavRef = useRef(false);

  useEffect(() => {
    Promise.all([api.get('/departments'), api.get('/doctypes')]).then(([d, t]) => {
      const deptList = d.data.data;
      setDepts(deptList);
      setTypes(t.data.data);
      if (!isAdmin && user?.subDepartment) {
        const myDept = deptList.find(
          (dep) => dep.name === user.subDepartment || dep._id === user.subDepartment
        );
        if (myDept) setForm((f) => ({ ...f, dept_id: myDept._id }));
      }
    }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (blockNavRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const setFileField = (idx, field, val) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  };

  const addFile = () => setFiles((prev) => [...prev, emptyFile()]);
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('กรุณาระบุชื่อเอกสาร');
    if (!form.dept_id) return toast.error('กรุณาเลือกหน่วยงาน');
    if (!form.type_id) return toast.error('กรุณาเลือกประเภทเอกสาร');

    const validFiles = files.filter((f) => f.file);
    if (validFiles.length === 0) return toast.error('กรุณาแนบไฟล์เอกสารอย่างน้อย 1 ไฟล์');
    for (const f of files) {
      if (f.file && !f.sub_title.trim()) return toast.error('กรุณาระบุชื่อไฟล์แนบทุกรายการ');
    }

    setSubmitting(true);
    blockNavRef.current = true;
    try {
      const { data } = await api.post('/documents', {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      const docId = data.data._id;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.file) continue;
        setUploadProgress({ current: i + 1, total: validFiles.length, name: f.file.name });
        const fd = new FormData();
        fd.append('file', f.file);
        fd.append('sub_title', f.sub_title.trim());
        await api.post(`/documents/${docId}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      blockNavRef.current = false;
      setUploadProgress(null);
      toast.success('บันทึกเอกสารเรียบร้อย');
      navigate(`/documents/${docId}`);
    } catch (err) {
      blockNavRef.current = false;
      setUploadProgress(null);
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">เพิ่มเอกสารใหม่</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อเอกสาร <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="ระบุชื่อเอกสาร"
            maxLength={1000}
          />
        </div>

        {/* Dept + Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หน่วยงาน <span className="text-red-500">*</span>
            </label>
            {isAdmin ? (
              <select
                value={form.dept_id}
                onChange={(e) => setForm({ ...form, dept_id: e.target.value })}
                className={inputClass}
              >
                <option value="">-- เลือกหน่วยงาน --</option>
                {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            ) : (
              <div>
                <input
                  readOnly
                  value={depts.find((d) => d._id === form.dept_id)?.name || 'กำลังโหลด...'}
                  className={`${inputClass} bg-gray-50 text-gray-600 cursor-not-allowed`}
                />
                <p className="text-xs text-gray-400 mt-0.5">ถูกกำหนดตามหน่วยงานของคุณ</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ประเภทเอกสาร <span className="text-red-500">*</span>
            </label>
            <select
                value={form.type_id}
                onChange={(e) => setForm({ ...form, type_id: e.target.value })}
                className={inputClass}
              >
                <option value="">-- เลือกประเภท --</option>
                {types.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            rows={3}
            maxLength={2000}
            placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags <span className="text-xs text-gray-400">(คั่นด้วยจุลภาค)</span>
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className={inputClass}
            placeholder="เช่น: งบประมาณ, ปี2567, สัญญา"
          />
        </div>

        {/* File Attachments */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              ไฟล์แนบ <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(บังคับอย่างน้อย 1 ไฟล์)</span>
            </p>
            <button
              type="button"
              onClick={addFile}
              className="flex items-center gap-1 text-primary border border-primary px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition"
            >+ เพิ่มไฟล์</button>
          </div>

          {files.map((f, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">ไฟล์ที่ {idx + 1}</span>
                {files.length > 1 && (
                  <button type="button" onClick={() => removeFile(idx)}
                    className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  ชื่อเอกสารย่อย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={f.sub_title}
                  onChange={(e) => setFileField(idx, 'sub_title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ระบุชื่อไฟล์แนบ เช่น สัญญาหลัก"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เลือกไฟล์</label>
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setFileField(idx, 'file', e.target.files[0] || null)}
                  className="text-sm text-gray-600"
                />
                {f.file && (
                  <p className="text-xs text-gray-400 mt-1">
                    {f.file.name} ({(f.file.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60"
          >
            {submitting ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
          </button>
          <button
            type="button"
            onClick={() => !submitting && navigate(-1)}
            disabled={submitting}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
          >
            ยกเลิก
          </button>
        </div>
      </form>

      {/* Upload Progress Modal */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-semibold text-gray-800">กำลังอัปโหลดเอกสาร...</p>
            <p className="text-sm text-gray-500">ไฟล์ที่ {uploadProgress.current} / {uploadProgress.total}</p>
            <p className="text-xs text-gray-400 truncate">{uploadProgress.name}</p>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-orange-600">⚠️ กรุณาอย่าปิดหน้าต่างนี้</p>
          </div>
        </div>
      )}

    </div>
  );
}
