import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function emptyFile() {
  return { sub_title: '', file: null };
}

export default function DocumentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [publicDurationHours, setPublicDurationHours] = useState(24);
  const [form, setForm] = useState({
    title: '',
    description: '',
    tags: '',
    is_public: false,
    public_expires_at: null,
  });
  const [attachments, setAttachments] = useState([]); // ไฟล์แนบที่มีอยู่แล้ว
  const [newFiles, setNewFiles] = useState([emptyFile()]);
  const [deletingSubId, setDeletingSubId] = useState(null); // sub_id กำลังลบ
  const blockNavRef = useRef(false);

  useEffect(() => {
    Promise.all([
      api.get(`/documents/${id}`),
      api.get('/admin/public-settings').catch(() => ({ data: { data: { public_duration_hours: 24 } } })),
    ])
      .then(([{ data }, { data: ps }]) => {
        const doc = data.data;
        setForm({
          title: doc.title || '',
          description: doc.description || '',
          tags: (doc.tags || []).join(', '),
          is_public: doc.is_public || false,
          public_expires_at: doc.public_expires_at || null,
        });
        setAttachments(doc.attachments || []);
        setPublicDurationHours(ps.data?.public_duration_hours ?? 24);
      })
      .catch(() => toast.error('โหลดเอกสารไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handler = (e) => {
      if (blockNavRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const setFileField = (idx, field, val) =>
    setNewFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  const addFile = () => setNewFiles((prev) => [...prev, emptyFile()]);
  const removeFile = (idx) => setNewFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDeleteAttachment = async (subId, subTitle) => {
    if (!window.confirm(`ลบไฟล์ "${subTitle}" ออกจากการแสดงผล?\n\nไฟล์จะถูกซ่อนและสามารถกู้คืนได้โดยแอดมิน`)) return;
    setDeletingSubId(subId);
    try {
      await api.delete(`/documents/${id}/attachments/${subId}`);
      setAttachments((prev) => prev.filter((a) => a.sub_id !== subId));
      toast.success('ลบไฟล์แนบเรียบร้อย');
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeletingSubId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('กรุณาระบุชื่อเอกสาร');

    // ตรวจ newFiles ถ้ากรอกแต่ไม่ครบ
    for (const f of newFiles) {
      if ((f.file && !f.sub_title.trim()) || (!f.file && f.sub_title.trim())) {
        return toast.error('กรุณากรอกทั้งชื่อและเลือกไฟล์ให้ครบทุกรายการที่เพิ่ม');
      }
    }

    const validFiles = newFiles.filter((f) => f.file && f.sub_title.trim());

    setSaving(true);
    try {
      // 1. บันทึกข้อมูลเอกสาร
      await api.patch(`/documents/${id}`, {
        title: form.title.trim(),
        description: form.description.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        is_public: form.is_public,
      });

      // 2. upload ไฟล์ใหม่ (ถ้ามี)
      if (validFiles.length > 0) {
        setSaving(false);
        setUploading(true);
        blockNavRef.current = true;
        for (let i = 0; i < validFiles.length; i++) {
          const f = validFiles[i];
          setUploadProgress({ current: i + 1, total: validFiles.length, name: f.file.name });
          const fd = new FormData();
          fd.append('file', f.file);
          fd.append('sub_title', f.sub_title.trim());
          await api.post(`/documents/${id}/attachments`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        blockNavRef.current = false;
        setUploadProgress(null);
        setUploading(false);
      }

      toast.success('บันทึกเรียบร้อย');
      navigate(`/documents/${id}`);
    } catch (err) {
      blockNavRef.current = false;
      setUploadProgress(null);
      setUploading(false);
      setSaving(false);
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';
  const isDisabled = saving || uploading;

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/documents/${id}`} className="text-sm text-primary hover:underline">← กลับ</Link>
        <h2 className="text-xl font-bold text-gray-800">แก้ไขเอกสาร</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อเอกสาร <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            maxLength={1000}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            rows={3}
            maxLength={2000}
          />
        </div>

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

        {/* เปิดให้บุคคลทั่วไปเห็น */}
        {(() => {
          const now = new Date();
          const expiresAt = form.public_expires_at ? new Date(form.public_expires_at) : null;
          const isExpired = expiresAt && expiresAt <= now;
          const isActive = form.is_public && expiresAt && expiresAt > now;
          const isLegacyPublic = form.is_public && !expiresAt; // เปิดอยู่แต่ไม่มี expiry (ข้อมูลเก่า)
          return (
            <div className="border border-gray-200 rounded-lg p-3 space-y-1 bg-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={form.is_public}
                  onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="is_public" className="text-sm font-medium text-gray-700">
                  เปิดให้บุคคลทั่วไปเห็น
                </label>
              </div>
              {isActive && (
                <p className="text-xs text-green-600 pl-6">
                  ✅ กำลังเปิดอยู่ · หมดเวลา{' '}
                  {expiresAt.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  {' '}· การบันทึกจะไม่เปลี่ยนแปลงเวลานี้
                </p>
              )}
              {(isExpired || isLegacyPublic) && form.is_public && (
                <p className="text-xs text-orange-500 pl-6">
                  ⏳ {isExpired ? 'หมดเวลาแล้ว — ' : ''}บันทึกเพื่อเริ่มนาฬิกา {publicDurationHours} ชั่วโมงใหม่
                </p>
              )}
              {!form.is_public && (
                <p className="text-xs text-gray-400 pl-6">
                  ถ้าเปิด ผู้ใช้ทุกคนจะมองเห็นได้เป็นเวลา {publicDurationHours} ชั่วโมง
                </p>
              )}
            </div>
          );
        })()}

        {/* ตารางไฟล์แนบที่มีอยู่ */}
        {attachments.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              ไฟล์แนบปัจจุบัน
              <span className="text-xs font-normal text-gray-400 ml-1">({attachments.length} รายการ)</span>
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">ชื่อเอกสารย่อย</th>
                    <th className="text-left px-4 py-2 font-medium">ชื่อไฟล์</th>
                    <th className="text-right px-4 py-2 font-medium">ขนาด</th>
                    {attachments.length > 1 && <th className="px-4 py-2"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attachments.map((att, idx) => (
                    <tr key={att.sub_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-800">{att.sub_title}</td>
                      <td className="px-4 py-2 text-gray-500 max-w-[200px] truncate" title={att.original_name}>
                        {att.original_name}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-right whitespace-nowrap">
                        {(att.file_size / 1024).toFixed(1)} KB
                      </td>
                      {attachments.length > 1 && (
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.sub_id, att.sub_title)}
                            disabled={deletingSubId === att.sub_id}
                            className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                          >
                            {deletingSubId === att.sub_id ? 'กำลังลบ...' : 'ลบ'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* เพิ่มไฟล์แนบใหม่ */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              เพิ่มไฟล์แนบ
              <span className="text-xs font-normal text-gray-400 ml-1">(ไม่บังคับ เฉพาะ PDF)</span>
            </p>
            <button
              type="button"
              onClick={addFile}
              className="flex items-center gap-1 text-primary border border-primary px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition"
            >+ เพิ่มไฟล์</button>
          </div>

          {newFiles.map((f, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">ไฟล์ที่ {idx + 1}</span>
                {newFiles.length > 1 && (
                  <button type="button" onClick={() => removeFile(idx)}
                    className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อเอกสารย่อย</label>
                <input
                  type="text"
                  value={f.sub_title}
                  onChange={(e) => setFileField(idx, 'sub_title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ระบุชื่อ เช่น สัญญาแก้ไขเพิ่มเติม"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เลือกไฟล์ PDF</label>
                <input
                  type="file"
                  accept=".pdf"
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isDisabled}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : uploading ? 'กำลังอัปโหลด...' : 'บันทึก'}
          </button>
          <button
            type="button"
            onClick={() => !isDisabled && navigate(`/documents/${id}`)}
            disabled={isDisabled}
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
            <p className="font-semibold text-gray-800">กำลังอัปโหลดไฟล์แนบ...</p>
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
