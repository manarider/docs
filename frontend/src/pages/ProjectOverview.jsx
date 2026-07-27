import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function ProjectOverview() {
  const { project, setProject, isInternal } = useOutletContext();
  const { projectId } = useParams();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    fiscal_year: '',
    location: '',
    district: '',
    province: '',
    phone: '',
    work_volume: '',
    quantity: '',
    contract_no: '',
    contract_date: '',
    contract_month: '',
    contract_year: '',
    start_date: '',
    end_date: '',
    budget: '',
    contractor: '',
    duration: '',
    status: 'active',
    supervisor: '',
    committee_chairman: '',
    committee_member_1: '',
    committee_member_2: '',
  });

  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title || '',
        fiscal_year: project.fiscal_year || '',
        location: project.location || '',
        district: project.district || '',
        province: project.province || '',
        phone: project.phone || '',
        work_volume: project.work_volume || '',
        quantity: project.quantity || '',
        contract_no: project.contract_no || '',
        contract_date: project.contract_date || '',
        contract_month: project.contract_month || '',
        contract_year: project.contract_year || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        budget: project.budget || '',
        contractor: project.contractor || '',
        duration: project.duration || '',
        status: project.status || 'active',
        supervisor: project.supervisor || '',
        committee_chairman: project.committee_chairman || '',
        committee_member_1: project.committee_member_1 || '',
        committee_member_2: project.committee_member_2 || '',
      });
    }
  }, [project]);

  const accessUrl = window.location.origin + '/docs/project-access?projectId=' + projectId;

  const handleCopy = () => {
    navigator.clipboard.writeText(accessUrl);
    toast.success('คัดลอก link แล้ว');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('กรุณาระบุชื่อโครงการ');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}`, formData);
      if (res.data.success) {
        toast.success('บันทึกข้อมูลโครงการแล้ว');
        if (setProject) {
          setProject(res.data.data);
        }
        setIsEditing(false);
      } else {
        toast.error(res.data.error || 'ไม่สามารถบันทึกได้');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      toast.error(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 border-b pb-3">
          <h2 className="font-semibold text-gray-800 text-lg">ข้อมูลโครงการ</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-1"
            >
              ✏️ แก้ไขข้อมูล
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          )}
        </div>

        {!isEditing ? (
          /* View Mode */
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="md:col-span-2 lg:col-span-3 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
              <dt className="text-gray-500 text-xs font-semibold">ชื่อโครงการ <span className="text-red-500">*</span></dt>
              <dd className="font-semibold text-gray-900 mt-1 text-base">{project?.title || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">หน่วยงาน (อัตโนมัติ)</dt>
              <dd className="font-medium text-gray-800 mt-1 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200">
                {project?.dept_id?.name || '-'}
              </dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ปีงบประมาณ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.fiscal_year ? `พ.ศ. ${project.fiscal_year}` : '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">สถานะ</dt>
              <dd className="mt-1">
                <span className={project?.status === 'active' ? 'inline-block text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-800' : 'inline-block text-xs px-2.5 py-1 rounded-full font-medium bg-gray-200 text-gray-600'}>
                  {project?.status === 'active' ? 'กำลังดำเนินการ' : 'ปิดแล้ว'}
                </span>
              </dd>
            </div>

            <div className="md:col-span-2 lg:col-span-3 border-t pt-3 mt-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ข้อมูลสถานที่ & สัญญา</h3>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">สถานที่ดำเนินการ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.location || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">อำเภอ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.district || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">จังหวัด</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.province || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">โทรศัพท์</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.phone || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ปริมาณงาน</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.work_volume || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">จำนวน</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.quantity || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">สัญญาเลขที่</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.contract_no || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ลงวันที่ / เดือน / พ.ศ.</dt>
              <dd className="font-medium text-gray-800 mt-1">
                {[project?.contract_date, project?.contract_month, project?.contract_year].filter(Boolean).join(' ') || '-'}
              </dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ระยะเวลาดำเนินการ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.duration || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">เริ่มสัญญาวันที่</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.start_date || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">สิ้นสุดสัญญาวันที่</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.end_date || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">วงเงินโครงการ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.budget || '-'}</dd>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <dt className="text-gray-500 text-xs">ผู้รับจ้าง</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.contractor || '-'}</dd>
            </div>

            <div className="md:col-span-2 lg:col-span-3 border-t pt-3 mt-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ผู้ควบคุมงาน & คณะกรรมการ</h3>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ผู้ควบคุมงาน</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.supervisor || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">ประธานกรรมการ</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.committee_chairman || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">กรรมการ 1</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.committee_member_1 || '-'}</dd>
            </div>

            <div>
              <dt className="text-gray-500 text-xs">กรรมการ 2</dt>
              <dd className="font-medium text-gray-800 mt-1">{project?.committee_member_2 || '-'}</dd>
            </div>
          </dl>
        ) : (
          /* Edit Mode Form */
          <form onSubmit={handleSave} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ชื่อโครงการ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">หน่วยงาน (อัตโนมัติ)</label>
                <input
                  type="text"
                  value={project?.dept_id?.name || '-'}
                  disabled
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ปีงบประมาณ</label>
                <input
                  type="number"
                  name="fiscal_year"
                  value={formData.fiscal_year}
                  onChange={handleChange}
                  placeholder="เช่น 2569"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">สถานะ</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">กำลังดำเนินการ (active)</option>
                  <option value="closed">ปิดโครงการแล้ว (closed)</option>
                </select>
              </div>

              <div className="md:col-span-2 lg:col-span-3 border-t pt-3 mt-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">ข้อมูลสถานที่ & สัญญา</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">สถานที่ดำเนินการ</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">อำเภอ</label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">จังหวัด</label>
                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">โทรศัพท์</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ปริมาณงาน</label>
                <input
                  type="text"
                  name="work_volume"
                  value={formData.work_volume}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">จำนวน</label>
                <input
                  type="text"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">สัญญาเลขที่</label>
                <input
                  type="text"
                  name="contract_no"
                  value={formData.contract_no}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ลงวันที่</label>
                <input
                  type="text"
                  name="contract_date"
                  value={formData.contract_date}
                  onChange={handleChange}
                  placeholder="เช่น 15"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">เดือน / พ.ศ.</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="contract_month"
                    value={formData.contract_month}
                    onChange={handleChange}
                    placeholder="เช่น มกราคม"
                    className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    name="contract_year"
                    value={formData.contract_year}
                    onChange={handleChange}
                    placeholder="เช่น 2569"
                    className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">เริ่มสัญญาวันที่</label>
                <input
                  type="text"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  placeholder="เช่น 1 ม.ค. 2569"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">สิ้นสุดสัญญาวันที่</label>
                <input
                  type="text"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  placeholder="เช่น 31 ธ.ค. 2569"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ระยะเวลาดำเนินการ</label>
                <input
                  type="text"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  placeholder="เช่น 360 วัน"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">วงเงินโครงการ</label>
                <input
                  type="text"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  placeholder="เช่น 1,500,000 บาท"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">ผู้รับจ้าง</label>
                <input
                  type="text"
                  name="contractor"
                  value={formData.contractor}
                  onChange={handleChange}
                  placeholder="ชื่อบริษัท/ห้างหุ้นส่วนจำกัด"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3 border-t pt-3 mt-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">ผู้ควบคุมงาน & คณะกรรมการ</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ผู้ควบคุมงาน</label>
                <input
                  type="text"
                  name="supervisor"
                  value={formData.supervisor}
                  onChange={handleChange}
                  placeholder="ชื่อผู้ควบคุมงาน"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ประธานกรรมการ</label>
                <input
                  type="text"
                  name="committee_chairman"
                  value={formData.committee_chairman}
                  onChange={handleChange}
                  placeholder="ชื่อประธานกรรมการ"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">กรรมการ 1</label>
                <input
                  type="text"
                  name="committee_member_1"
                  value={formData.committee_member_1}
                  onChange={handleChange}
                  placeholder="ชื่อกรรมการคนที่ 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">กรรมการ 2</label>
                <input
                  type="text"
                  name="committee_member_2"
                  value={formData.committee_member_2}
                  onChange={handleChange}
                  placeholder="ชื่อกรรมการคนที่ 2"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        )}
      </div>

      {isInternal && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🔗 Link สำหรับผู้ใช้ภายนอก</h3>
          <p className="text-xs text-gray-500 mb-2">ส่ง link นี้ให้ผู้รับจ้าง / ผู้ควบคุมงาน เพื่อเข้าใช้งานระบบโครงการ</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <a href={accessUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs font-mono text-primary hover:underline truncate">
              {accessUrl}
            </a>
            <button
              onClick={handleCopy}
              className={copied ? 'shrink-0 text-xs px-3 py-1 rounded transition border bg-green-50 border-green-300 text-green-700' : 'shrink-0 text-xs px-3 py-1 rounded transition border bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}
            >
              {copied ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
