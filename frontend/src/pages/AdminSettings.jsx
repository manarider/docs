import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

const TABS = [
  { id: 'general', label: 'ทั่วไป', icon: '⚙️' },
  { id: 'departments', label: 'หน่วยงาน', icon: '🏢' },
  { id: 'doctypes', label: 'ประเภทเอกสาร', icon: '🗂️' },
  { id: 'backup', label: 'Backup', icon: '💾' },
];

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-800">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ─── Tab: General ─────────────────────────────────────────────────────────────
function TabGeneral() {
  const [hours, setHours] = useState('');
  const [maxDocMB, setMaxDocMB] = useState('');
  const [maxImgMB, setMaxImgMB] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => {
        const s = data.data || {};
        setHours(String(s.public_duration_hours ?? 24));
        setMaxDocMB(String(s.max_doc_size_mb ?? 50));
        setMaxImgMB(String(s.max_img_size_mb ?? 3));
      })
      .catch(() => toast.error('โหลดการตั้งค่าไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key, value, desc) => {
    await api.put(`/admin/settings/${key}`, { value: Number(value), description: desc });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const h = parseInt(hours, 10);
    const doc = parseInt(maxDocMB, 10);
    const img = parseInt(maxImgMB, 10);
    if (isNaN(h) || h < 1 || h > 8760) return toast.error('ระยะเวลา public: 1–8760 ชั่วโมง');
    if (isNaN(doc) || doc < 1 || doc > 500) return toast.error('ขนาดไฟล์เอกสาร: 1–500 MB');
    if (isNaN(img) || img < 1 || img > 20) return toast.error('ขนาดไฟล์รูปภาพ: 1–20 MB');
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('public_duration_hours', h, 'ระยะเวลา (ชั่วโมง) ที่เอกสาร is_public มองเห็นได้'),
        saveSetting('max_doc_size_mb', doc, 'ขนาดไฟล์เอกสารสูงสุด (MB)'),
        saveSetting('max_img_size_mb', img, 'ขนาดไฟล์รูปภาพสูงสุด (MB)'),
      ]);
      toast.success('บันทึกเรียบร้อย');
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">กำลังโหลด...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-lg">
      <div className="bg-white rounded-xl shadow p-5 space-y-5">
        <h3 className="font-semibold text-gray-700 border-b pb-2">การแชร์เอกสาร</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ระยะเวลาเปิดให้บุคคลทั่วไปเห็น (ชั่วโมง)
          </label>
          <p className="text-xs text-gray-400 mb-2">หลังจากกด "เปิดเผยต่อสาธารณะ" เอกสารจะมองเห็นได้ตามระยะเวลานี้</p>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={8760} value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <span className="text-sm text-gray-500">ชั่วโมง</span>
            {hours && !isNaN(parseInt(hours)) && parseInt(hours) >= 24 && (
              <span className="text-xs text-gray-400">({Math.floor(parseInt(hours)/24)} วัน{parseInt(hours)%24 > 0 ? ` ${parseInt(hours)%24} ชม.` : ''})</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-5">
        <h3 className="font-semibold text-gray-700 border-b pb-2">ขนาดไฟล์ที่อนุญาต</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เอกสาร (PDF) สูงสุด</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={500} value={maxDocMB}
                onChange={(e) => setMaxDocMB(e.target.value)}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-sm text-gray-500">MB</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพ สูงสุด</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={20} value={maxImgMB}
                onChange={(e) => setMaxImgMB(e.target.value)}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-sm text-gray-500">MB</span>
            </div>
          </div>
        </div>
        </div>
      <button type="submit" disabled={saving}
        className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
      </button>
    </form>
  );
}

// ─── Tab: Departments ─────────────────────────────────────────────────────────
function TabDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/departments?active=all')
      .then(({ data }) => setDepts(data.data))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setForm({ name: '', code: '' }); setShowForm(true); };
  const openEdit = (d) => { setEditTarget(d); setForm({ name: d.name, code: d.code }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('กรุณาระบุชื่อหน่วยงาน');
    if (!editTarget && !form.code.trim()) return toast.error('กรุณาระบุรหัสหน่วยงาน');
    setSaving(true);
    try {
      if (editTarget) {
        await api.patch(`/departments/${editTarget._id}`, { name: form.name });
        toast.success('อัปเดตเรียบร้อย');
      } else {
        await api.post('/departments', { name: form.name, code: form.code });
        toast.success('สร้างหน่วยงานเรียบร้อย');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d) => {
    try {
      await api.patch(`/departments/${d._id}`, { isActive: !d.isActive });
      toast.success(d.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
      load();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleDelete = async (d) => {
    if (!confirm(`ยืนยันลบหน่วยงาน "${d.name}"?`)) return;
    try {
      await api.delete(`/departments/${d._id}`);
      toast.success('ลบเรียบร้อย');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{depts.length} หน่วยงาน</p>
        <button onClick={openCreate}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition">
          + เพิ่มหน่วยงาน
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อหน่วยงาน</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">รหัส</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">สถานะ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {depts.map((d) => (
                <tr key={d._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.isActive ? 'ใช้งาน' : 'ปิดใช้'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openEdit(d)} className="text-blue-600 hover:underline text-xs">แก้ไข</button>
                      <button onClick={() => toggleActive(d)} className="text-yellow-600 hover:underline text-xs">{d.isActive ? 'ปิด' : 'เปิด'}</button>
                      <button onClick={() => handleDelete(d)} className="text-red-600 hover:underline text-xs">ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
              {depts.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editTarget ? 'แก้ไขหน่วยงาน' : 'เพิ่มหน่วยงานใหม่'} onClose={() => setShowForm(false)}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยงาน *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น กองคลัง" maxLength={200} />
          </div>
          {!editTarget && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัส *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="เช่น FINANCE" maxLength={20} />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab: DocTypes ─────────────────────────────────────────────────────────────
function TabDocTypes() {
  const [types, setTypes] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [docsModal, setDocsModal] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/doctypes?active=all'), api.get('/doctypes/pending')])
      .then(([a, p]) => { setTypes(a.data.data); setPending(p.data.data); })
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setForm({ name: '', code: '', description: '' }); setShowForm(true); };
  const openEdit = (t) => { setEditTarget(t); setForm({ name: t.name, code: t.code, description: t.description || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('กรุณาระบุชื่อ');
    if (!editTarget && !form.code.trim()) return toast.error('กรุณาระบุรหัส');
    setSaving(true);
    try {
      if (editTarget) {
        await api.patch(`/doctypes/${editTarget._id}`, { name: form.name, description: form.description });
      } else {
        await api.post('/doctypes', { name: form.name, code: form.code, description: form.description });
      }
      toast.success(editTarget ? 'อัปเดตเรียบร้อย' : 'สร้างเรียบร้อย');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t) => {
    try {
      await api.patch(`/doctypes/${t._id}`, { isActive: !t.isActive });
      toast.success(t.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
      load();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleApprove = async (t) => {
    try {
      await api.post(`/doctypes/${t._id}/approve`);
      toast.success(`อนุมัติ "${t.name}" เรียบร้อย`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const openDocsModal = async (t) => {
    setDocsModal({ type: t, docs: [] });
    setDocsLoading(true);
    try {
      const { data } = await api.get(`/doctypes/${t._id}/documents`);
      setDocsModal({ type: t, docs: data.data });
    } catch { toast.error('โหลดเอกสารไม่สำเร็จ'); }
    finally { setDocsLoading(false); }
  };

  const handleDelete = async (t) => {
    if (!confirm(`ยืนยันลบประเภท "${t.name}"?`)) return;
    try {
      await api.delete(`/doctypes/${t._id}`);
      toast.success('ลบเรียบร้อย');
      setDocsModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{types.length} ประเภท</p>
        <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition">
          + เพิ่มประเภท
        </button>
      </div>

      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-700 mb-3">⏳ รอการอนุมัติ ({pending.length} รายการ)</p>
          <div className="space-y-2">
            {pending.map((t) => (
              <div key={t._id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm flex-wrap gap-2">
                <span className="font-medium text-gray-800">{t.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => openDocsModal(t)} className="text-blue-600 hover:underline text-xs">ดูเอกสาร</button>
                  <button onClick={() => handleApprove(t)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700">อนุมัติ</button>
                  <button onClick={() => handleDelete(t)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-medium hover:bg-red-200">ปฏิเสธ</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อประเภท</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">รหัส</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">คำอธิบาย</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">สถานะ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{t.description || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.isActive ? 'ใช้งาน' : 'ปิดใช้'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-xs">แก้ไข</button>
                      <button onClick={() => toggleActive(t)} className="text-yellow-600 hover:underline text-xs">{t.isActive ? 'ปิด' : 'เปิด'}</button>
                      <button onClick={() => openDocsModal(t)} className="text-red-600 hover:underline text-xs">ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editTarget ? 'แก้ไขประเภทเอกสาร' : 'เพิ่มประเภทใหม่'} onClose={() => setShowForm(false)}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภท *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
          </div>
          {!editTarget && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัส *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </Modal>
      )}

      {docsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
            <h3 className="font-bold text-gray-800">เอกสารในประเภท "{docsModal.type.name}"</h3>
            <div className="flex-1 overflow-y-auto">
              {docsLoading ? (
                <p className="text-center py-8 text-gray-400">กำลังโหลด...</p>
              ) : docsModal.docs.length === 0 ? (
                <p className="text-center py-8 text-gray-400">ไม่มีเอกสาร — สามารถลบประเภทนี้ได้</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded">⚠️ ต้องย้ายเอกสาร {docsModal.docs.length} รายการออกก่อนจึงจะลบได้</p>
                  {docsModal.docs.map((d) => (
                    <div key={d._id} className="flex justify-between text-sm border rounded-lg px-3 py-2">
                      <span className="text-gray-800">{d.title}</span>
                      <span className="text-gray-400 text-xs">{d.dept_id?.name} · ปีงบ {d.fiscal_year}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setDocsModal(null)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">ปิด</button>
              {docsModal.docs.length === 0 && (
                <button onClick={() => handleDelete(docsModal.type)} className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700">ยืนยันลบ</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Backup ──────────────────────────────────────────────────────────────
function TabBackup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/backups')
      .then(({ data }) => setBackups(data.data || []))
      .catch(() => toast.error('โหลดรายการ backup ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    if (!confirm('ยืนยัน backup ฐานข้อมูลตอนนี้?')) return;
    setTriggering(true);
    try {
      const { data } = await api.post('/admin/backups/trigger');
      toast.success(data.message || 'กำลัง backup...');
      setTimeout(load, 8000); // รอ 8 วินาทีแล้ว refresh
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setTriggering(false);
    }
  };

  const handleDownload = (filename) => {
    window.open(`/docs/api/admin/backups/${encodeURIComponent(filename)}/download`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">Backup อัตโนมัติ</p>
          <p className="text-xs text-blue-600 mt-1">ระบบ backup อัตโนมัติทุกวันเวลา 02:00 น. เก็บไว้ 14 วัน</p>
          <p className="text-xs text-gray-500 mt-1">ไฟล์เก็บอยู่ที่: <code className="bg-white px-1 rounded">/data/backups/mongodb/</code></p>
        </div>
        <button onClick={handleTrigger} disabled={triggering}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60 shrink-0">
          {triggering ? '⏳ กำลัง backup...' : '💾 Backup ทันที'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">รายการ Backup ({backups.length} ไฟล์)</p>
        <button onClick={load} className="text-xs text-primary hover:underline">รีเฟรช</button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
      ) : backups.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">💾</p>
          <p>ยังไม่มีไฟล์ backup</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อไฟล์</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">วันที่สร้าง</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">ขนาด</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">ดาวน์โหลด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.map((b) => (
                <tr key={b.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-mono text-xs break-all">{b.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 tabular-nums whitespace-nowrap">{fmtBytes(b.size)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDownload(b.name)}
                      className="text-primary hover:text-primary-dark text-sm" title="ดาวน์โหลด">
                      ⬇️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">ตั้งค่าระบบ</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white shadow text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'general' && <TabGeneral />}
        {activeTab === 'departments' && <TabDepartments />}
        {activeTab === 'doctypes' && <TabDocTypes />}
        {activeTab === 'backup' && <TabBackup />}
      </div>
    </div>
  );
}
