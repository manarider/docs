import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [hours, setHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => {
        setHours(String(data.data?.public_duration_hours ?? 24));
      })
      .catch(() => toast.error('โหลดการตั้งค่าไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const val = parseInt(hours, 10);
    if (isNaN(val) || val < 1 || val > 8760) {
      return toast.error('กรุณาระบุจำนวนชั่วโมง 1–8760');
    }
    setSaving(true);
    try {
      await api.put('/admin/settings/public_duration_hours', {
        value: val,
        description: 'ระยะเวลา (ชั่วโมง) ที่เอกสาร is_public จะมองเห็นได้โดยผู้ใช้ทุกคน',
      });
      toast.success('บันทึกเรียบร้อย');
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">การตั้งค่าระบบ</h2>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ระยะเวลาเปิดให้บุคคลทั่วไปเห็น (ชั่วโมง)
          </label>
          <p className="text-xs text-gray-400 mb-2">
            เมื่อ admin/เจ้าของเอกสารเปิด "เปิดให้บุคคลทั่วไปเห็น" ผู้ใช้ทุกคนจะมองเห็นเอกสารนั้นเป็นเวลาที่กำหนดนี้
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm text-gray-500">ชั่วโมง</span>
            {hours && !isNaN(parseInt(hours, 10)) && parseInt(hours, 10) >= 24 && (
              <span className="text-xs text-gray-400">
                ({Math.floor(parseInt(hours, 10) / 24)} วัน{parseInt(hours, 10) % 24 > 0 ? ` ${parseInt(hours, 10) % 24} ชม.` : ''})
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </form>
    </div>
  );
}
