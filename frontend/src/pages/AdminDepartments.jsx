import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/departments?active=all')
      .then(({ data }) => setDepts(data.data))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">จัดการหน่วยงาน</h2>
        <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition">
          + เพิ่มหน่วยงาน
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อหน่วยงาน</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">รหัส</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">สถานะ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
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
                      <button onClick={() => toggleActive(d)} className="text-yellow-600 hover:underline text-xs">
                        {d.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                      </button>
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">{editTarget ? 'แก้ไขหน่วยงาน' : 'เพิ่มหน่วยงานใหม่'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยงาน *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น กองคลัง"
                maxLength={200}
              />
            </div>
            {!editTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัส (ตัวอักษร/เลข) *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="เช่น FINANCE"
                  maxLength={20}
                />
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
