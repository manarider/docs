import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminDocTypes() {
  const [types, setTypes] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  // ดูเอกสารของประเภทที่รอลบ
  const [docsModal, setDocsModal] = useState(null); // { type, docs }
  const [docsLoading, setDocsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/doctypes?active=all'),
      api.get('/doctypes/pending'),
    ]).then(([a, p]) => {
      setTypes(a.data.data);
      setPending(p.data.data);
    }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
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
    if (!confirm(`ยืนยันลบประเภท "${t.name}"?\n(ต้องย้ายเอกสารออกก่อน)`)) return;
    try {
      await api.delete(`/doctypes/${t._id}`);
      toast.success('ลบเรียบร้อย');
      setDocsModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">จัดการประเภทเอกสาร</h2>
        <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition">
          + เพิ่มประเภท
        </button>
      </div>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-700 mb-3">⏳ รอการอนุมัติ ({pending.length} รายการ)</p>
          <div className="space-y-2">
            {pending.map((t) => (
              <div key={t._id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
                <div>
                  <span className="font-medium text-gray-800">{t.name}</span>
                  {t.description && <span className="text-xs text-gray-500 ml-2">— {t.description}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDocsModal(t)} className="text-blue-600 hover:underline text-xs">ดูเอกสาร</button>
                  <button onClick={() => handleApprove(t)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 transition">อนุมัติ</button>
                  <button onClick={() => handleDelete(t)} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-medium hover:bg-red-200 transition">ไม่อนุมัติ (ลบ)</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type list */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อประเภท</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">รหัส</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">คำอธิบาย</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">สถานะ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
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
                      <button onClick={() => toggleActive(t)} className="text-yellow-600 hover:underline text-xs">{t.isActive ? 'ปิดใช้' : 'เปิดใช้'}</button>
                      <button onClick={() => openDocsModal(t)} className="text-gray-600 hover:underline text-xs">ลบ</button>
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">{editTarget ? 'แก้ไขประเภทเอกสาร' : 'เพิ่มประเภทใหม่'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภท *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
            </div>
            {!editTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัส (ตัวอักษร/เลข/_) *</label>
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
          </div>
        </div>
      )}

      {/* Documents Modal (before delete) */}
      {docsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
            <h3 className="font-bold text-gray-800">เอกสารในประเภท "{docsModal.type.name}"</h3>
            <div className="flex-1 overflow-y-auto">
              {docsLoading ? (
                <p className="text-center py-8 text-gray-400">กำลังโหลด...</p>
              ) : docsModal.docs.length === 0 ? (
                <p className="text-center py-8 text-gray-400">ไม่มีเอกสาร — สามารถลบประเภทนี้ได้</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded">⚠️ ต้องย้ายเอกสาร {docsModal.docs.length} รายการออกก่อนจึงจะลบประเภทนี้ได้</p>
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
