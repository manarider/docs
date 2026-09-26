import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, staff: 25, member: 20, viewer: 10 };

export default function OutsourcedGroups() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canManage = (ROLE_LEVEL[user?.role] || 0) >= ROLE_LEVEL.staff;

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        api.get('/outsourced/groups')
            .then(({ data }) => setGroups(data.data))
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditTarget(null); setForm({ name: '', description: '' }); setShowForm(true); };
    const openEdit = (g) => { setEditTarget(g); setForm({ name: g.name, description: g.description || '' }); setShowForm(true); };

    const handleSave = async () => {
        if (!form.name.trim()) return toast.error('กรุณาระบุชื่อกลุ่มงาน');
        setSaving(true);
        try {
            if (editTarget) {
                await api.patch(`/outsourced/groups/${editTarget._id}`, form);
                toast.success('อัปเดตเรียบร้อย');
            } else {
                await api.post('/outsourced/groups', form);
                toast.success('สร้างกลุ่มงานเรียบร้อย');
            }
            setShowForm(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (g) => {
        try {
            await api.patch(`/outsourced/groups/${g._id}`, { isActive: !g.isActive });
            toast.success(g.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
            load();
        } catch {
            toast.error('เกิดข้อผิดพลาด');
        }
    };

    const handleDelete = async (g) => {
        if (!confirm(`ยืนยันลบกลุ่มงาน "${g.name}"?`)) return;
        try {
            await api.delete(`/outsourced/groups/${g._id}`);
            toast.success('ลบเรียบร้อย');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Outsourced — กลุ่มงาน</h2>
                    <p className="text-sm text-gray-500 mt-0.5">เลือกกลุ่มงานเพื่อจัดการฟอร์มการรายงานหรือบันทึกรายงาน</p>
                </div>
                {canManage && (
                    <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition shrink-0">
                        + เพิ่มกลุ่มงาน
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((g) => (
                        <div key={g._id} className="bg-white rounded-xl shadow p-4 space-y-3 border border-gray-100">
                            <div className="flex items-start justify-between">
                                <h3 className="font-semibold text-gray-800">{g.name}</h3>
                                <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {g.isActive ? 'ใช้งาน' : 'ปิดใช้'}
                                </span>
                            </div>
                            {g.description && <p className="text-sm text-gray-500 line-clamp-2">{g.description}</p>}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    onClick={() => navigate(`/outsourced/groups/${g._id}/reports`)}
                                    className="bg-orange-50 text-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                                >
                                    📋 รายงาน
                                </button>
                                {canManage && (
                                    <>
                                        <button
                                            onClick={() => navigate(`/outsourced/groups/${g._id}/forms`)}
                                            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                                        >
                                            🧾 ฟอร์มการรายงาน
                                        </button>
                                        <button onClick={() => openEdit(g)} className="text-blue-600 hover:underline text-xs">แก้ไข</button>
                                        <button onClick={() => toggleActive(g)} className="text-yellow-600 hover:underline text-xs">
                                            {g.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                                        </button>
                                        <button onClick={() => handleDelete(g)} className="text-red-600 hover:underline text-xs">ลบ</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-xl shadow">ไม่มีกลุ่มงาน</div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-gray-800">{editTarget ? 'แก้ไขกลุ่มงาน' : 'เพิ่มกลุ่มงานใหม่'}</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อกลุ่มงาน *</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="เช่น งานทำความสะอาด"
                                maxLength={200}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                maxLength={1000}
                            />
                        </div>
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
