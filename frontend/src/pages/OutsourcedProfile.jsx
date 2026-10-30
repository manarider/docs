import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function OutsourcedProfile() {
    const [form, setForm] = useState({ position: '', contract_number: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/outsourced/profile')
            .then(({ data }) => setForm({ position: data.data.position || '', contract_number: data.data.contract_number || '' }))
            .catch(() => toast.error('โหลดข้อมูลโปรไฟล์ไม่สำเร็จ'))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.position.trim()) return toast.error('กรุณาระบุตำแหน่งหน้าที่');
        if (!form.contract_number.trim()) return toast.error('กรุณาระบุเลขที่บันทึกตกลงจ้าง');

        setSaving(true);
        try {
            await api.put('/outsourced/profile', form);
            toast.success('บันทึกโปรไฟล์เรียบร้อย');
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;
    }

    return (
        <div className="space-y-5 max-w-lg">
            <div>
                <h2 className="text-xl font-bold text-gray-800">จัดการโปรไฟล์</h2>
                <p className="text-sm text-gray-500 mt-0.5">ข้อมูลนี้จะแสดงในรายงานการส่งมอบงาน (PDF)</p>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-5 space-y-4 border border-gray-100">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตำแหน่งหน้าที่ *</label>
                    <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={form.position}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                        placeholder="เช่น เจ้าหน้าที่ดูแลระบบกล้องโทรทัศน์วงจรปิด"
                        maxLength={200}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">บันทึกตกลงจ้างเลขที่ *</label>
                    <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={form.contract_number}
                        onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                        placeholder="เช่น ตล. 123/2569"
                        maxLength={200}
                    />
                </div>
                <div className="flex justify-end pt-1">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60"
                    >
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </form>
        </div>
    );
}
