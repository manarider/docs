import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PrintReportButton from '../components/PrintReportButton';

const today = () => new Date().toISOString().slice(0, 10);

const WEATHER_OPTIONS = [
  'ท้องฟ้าแจ่มใส',
  'ท้องฟ้าครึ้ม หรือมีเมฆมาก',
  'ฝนตกเล็กน้อย (ไม่มีอุปสรรคในการทำงาน)',
  'ฝนตกหนัก(ไม่สามารถทำงานได้)',
];

/* ─── helpers ────────────────────────────────────────────── */

function ImgPreviews({ files, onRemove }) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const created = Array.from(files).map((f) => URL.createObjectURL(f));
    setUrls(created);
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  if (!urls.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {urls.map((u, i) => (
        <div key={i} className="relative">
          <img src={u} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none">
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function UploadProgress({ progress }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>กำลัง upload...</span><span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/** ปุ่มเลือกรูปภาพ — gallery + ถ่ายภาพ */
function PhotoInputGroup({ onAddFiles, multiple = true, disabled = false }) {
  const addFiles = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) onAddFiles(files);
    e.target.value = '';
  };
  const base = `cursor-pointer inline-flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 select-none transition ${disabled ? 'opacity-50 pointer-events-none' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`;
  return (
    <div className="flex gap-2 flex-wrap mt-1">
      <label className={base}>
        <span>📁</span> เลือกจากเครื่อง
        <input type="file" accept="image/*" multiple={multiple} className="hidden" onChange={addFiles} disabled={disabled} />
      </label>
      <label className={base}>
        <span>📷</span> ถ่ายภาพ
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={addFiles} disabled={disabled} />
      </label>
    </div>
  );
}

/* ─── ReportCard ─────────────────────────────────────────── */

function ReportCard({ report, onView }) {
  const preview = report.morning_description || report.work_description || '';
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700">
          {new Date(report.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </span>
        <span className="text-xs text-gray-400">{report.submitted_role}</span>
      </div>
      {report.position && <p className="text-xs text-gray-500">📍 {report.position}</p>}
      <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{preview}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {report.photos?.length > 0 && <span>📷 {report.photos.length} รูป</span>}
        {report.equipment_items?.length > 0 && <span>🔧 ครุภัณฑ์ {report.equipment_items.length} รายการ</span>}
      </div>
      <button onClick={() => onView(report)} className="text-xs text-primary hover:underline">ดูรายละเอียด →</button>
    </div>
  );
}

/* ─── ReportDetail ───────────────────────────────────────── */

function ReportDetail({ report: init, projectId, onClose, onUpdated }) {
  const [report, setReport] = useState(init);
  const [editMode, setEditMode] = useState(false);

  const getInitialWeather = (rep) => {
    const isCustom = rep.weather && !WEATHER_OPTIONS.includes(rep.weather);
    return {
      weatherSelect: isCustom ? 'other' : (rep.weather || 'ท้องฟ้าแจ่มใส'),
      weatherCustom: isCustom ? rep.weather : '',
    };
  };

  const initWeather = getInitialWeather(init);

  const [editForm, setEditForm] = useState({
    morning_description: init.morning_description || init.work_description || '',
    afternoon_description: init.afternoon_description || '',
    position: init.position || '',
    weatherSelect: initWeather.weatherSelect,
    weatherCustom: initWeather.weatherCustom,
    obstacles: init.obstacles || '---',
    other_instructions: init.other_instructions || '---',
    engineer_count: init.engineer_count ?? 0,
    foreman_count: init.foreman_count ?? 0,
    laborer_count: init.laborer_count ?? 0,
  });
  // photo edit state
  const [keptFlags, setKeptFlags] = useState((init.photos || []).map(() => true));
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const hasMorning = !!report.morning_description;

  const handleSave = async () => {
    if (!editForm.morning_description.trim()) { toast.error('กรุณาระบุรายละเอียดภาคเช้า'); return; }

    const finalWeather = editForm.weatherSelect === 'other' ? editForm.weatherCustom : editForm.weatherSelect;
    if (editForm.weatherSelect === 'other' && !editForm.weatherCustom.trim()) {
      toast.error('กรุณาระบุสภาพภูมิอากาศอื่น ๆ');
      return;
    }

    setSaving(true); setUploading(false); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('morning_description', editForm.morning_description);
      fd.append('afternoon_description', editForm.afternoon_description);
      fd.append('position', editForm.position);
      fd.append('weather', finalWeather);
      fd.append('obstacles', editForm.obstacles.trim() || '---');
      fd.append('other_instructions', editForm.other_instructions.trim() || '---');
      fd.append('engineer_count', Number(editForm.engineer_count) || 0);
      fd.append('foreman_count', Number(editForm.foreman_count) || 0);
      fd.append('laborer_count', Number(editForm.laborer_count) || 0);

      // photo management
      const keepIndices = keptFlags.map((k, i) => k ? i : -1).filter((i) => i >= 0);
      fd.append('keep_photo_indices', JSON.stringify(keepIndices));
      newPhotoFiles.forEach((f) => fd.append('photos', f));

      const hasFiles = newPhotoFiles.length > 0;
      if (hasFiles) setUploading(true);

      const { data } = await api.patch(
        `/projects/${projectId}/daily-reports/${report._id}`,
        fd,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
        }
      );
      setReport(data.data);
      setKeptFlags((data.data.photos || []).map(() => true));
      setNewPhotoFiles([]);
      setEditMode(false);
      toast.success('บันทึกแล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); setUploading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('ยืนยันลบรายงานนี้?')) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/daily-reports/${report._id}`);
      toast.success('ลบรายงานแล้ว');
      onUpdated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
      setDeleting(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    const isCustom = report.weather && !WEATHER_OPTIONS.includes(report.weather);
    setEditForm({
      morning_description: report.morning_description || report.work_description || '',
      afternoon_description: report.afternoon_description || '',
      position: report.position || '',
      weatherSelect: isCustom ? 'other' : (report.weather || 'ท้องฟ้าแจ่มใส'),
      weatherCustom: isCustom ? report.weather : '',
      obstacles: report.obstacles || '---',
      other_instructions: report.other_instructions || '---',
      engineer_count: report.engineer_count ?? 0,
      foreman_count: report.foreman_count ?? 0,
      laborer_count: report.laborer_count ?? 0,
    });
    setKeptFlags((report.photos || []).map(() => true));
    setNewPhotoFiles([]);
  };

  const totalPhotoCount = keptFlags.filter(Boolean).length + newPhotoFiles.length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">
            รายงาน: {new Date(report.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}
          </h3>
          <div className="flex gap-2 items-center">
            <PrintReportButton
              projectId={projectId}
              module="daily_report"
              recordId={report._id}
              className="text-xs border border-primary text-primary rounded px-2 py-1 hover:bg-orange-50"
            />
            {!editMode && (
              <button onClick={() => setEditMode(true)} className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">แก้ไข</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* วันที่ + สถานที่ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">วันที่รายงาน</p>
              <p className="text-sm font-medium">{new Date(report.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">สถานที่</p>
              {editMode ? (
                <input type="text" value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
              ) : (
                <p className="text-sm">{report.position || <span className="text-gray-400 italic">ไม่ระบุ</span>}</p>
              )}
            </div>

            {/* สภาพภูมิอากาศ */}
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">สภาพภูมิอากาศ</p>
              {editMode ? (
                <div className="space-y-2">
                  <select
                    value={editForm.weatherSelect}
                    onChange={(e) => setEditForm((f) => ({ ...f, weatherSelect: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {WEATHER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="other">อื่น ๆ</option>
                  </select>
                  {editForm.weatherSelect === 'other' && (
                    <input
                      type="text"
                      placeholder="ระบุสภาพภูมิอากาศ (จำเป็น)"
                      value={editForm.weatherCustom}
                      onChange={(e) => setEditForm((f) => ({ ...f, weatherCustom: e.target.value }))}
                      required
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded inline-block">☀️ {report.weather || 'ท้องฟ้าแจ่มใส'}</p>
              )}
            </div>

            {/* จำนวนบุคลากร */}
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">จำนวนบุคลากร</p>
              {editMode ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">วิศวกร/ช่าง</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.engineer_count}
                      onChange={(e) => setEditForm((f) => ({ ...f, engineer_count: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">หัวหน้าคนงาน</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.foreman_count}
                      onChange={(e) => setEditForm((f) => ({ ...f, foreman_count: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">กรรมกร</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.laborer_count}
                      onChange={(e) => setEditForm((f) => ({ ...f, laborer_count: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">วิศวกร/ช่าง</p>
                    <p className="text-sm font-semibold text-gray-700">{report.engineer_count ?? 0} คน</p>
                  </div>
                  <div className="text-center border-x">
                    <p className="text-[10px] text-gray-400 uppercase">หัวหน้าคนงาน</p>
                    <p className="text-sm font-semibold text-gray-700">{report.foreman_count ?? 0} คน</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">กรรมกร</p>
                    <p className="text-sm font-semibold text-gray-700">{report.laborer_count ?? 0} คน</p>
                  </div>
                </div>
              )}
            </div>

            {/* ปัญหา/อุปสรรค */}
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">ปัญหา/อุปสรรค</p>
              {editMode ? (
                <input
                  type="text"
                  placeholder="ปัญหา/อุปสรรค (ไม่บังคับกรอก Default = ---)"
                  value={editForm.obstacles}
                  onChange={(e) => setEditForm((f) => ({ ...f, obstacles: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                />
              ) : (
                <p className="text-sm bg-amber-50/50 border border-amber-100 rounded-lg p-2 text-gray-700 whitespace-pre-line">{report.obstacles || '---'}</p>
              )}
            </div>

            {/* อื่น ๆ (การสั่งการ หรือการแก้ไข) */}
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">อื่น ๆ (การสั่งการ หรือการแก้ไข)</p>
              {editMode ? (
                <input
                  type="text"
                  placeholder="การสั่งการ หรือการแก้ไข (ไม่บังคับกรอก Default = ---)"
                  value={editForm.other_instructions}
                  onChange={(e) => setEditForm((f) => ({ ...f, other_instructions: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
                />
              ) : (
                <p className="text-sm bg-purple-50/50 border border-purple-100 rounded-lg p-2 text-gray-700 whitespace-pre-line">{report.other_instructions || '---'}</p>
              )}
            </div>
          </div>

          {/* รายละเอียด */}
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ภาคเช้า <span className="text-red-500">*</span></label>
                <textarea rows={5} value={editForm.morning_description}
                  onChange={(e) => setEditForm((f) => ({ ...f, morning_description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ภาคบ่าย</label>
                <textarea rows={5} value={editForm.afternoon_description}
                  onChange={(e) => setEditForm((f) => ({ ...f, afternoon_description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
              </div>
            </div>
          ) : hasMorning ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">ภาคเช้า</p>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 min-h-[60px]">
                  {report.morning_description || <span className="text-gray-400 italic">ไม่มีข้อมูล</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">ภาคบ่าย</p>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 min-h-[60px]">
                  {report.afternoon_description || <span className="text-gray-400 italic">ไม่มีข้อมูล</span>}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">รายละเอียดการทำงาน</p>
              <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3">{report.work_description}</p>
            </div>
          )}

          {/* ภาพถ่าย */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">
                ภาพถ่ายการปฏิบัติงาน
                {editMode && <span className="ml-1 text-gray-400">({totalPhotoCount}/6)</span>}
                {!editMode && report.photos?.length > 0 && <span className="ml-1">({report.photos.length} รูป)</span>}
              </p>
            </div>

            {/* รูปเดิม */}
            {report.photos?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                {report.photos.map((_, idx) => (
                  <div key={idx} className={`relative ${editMode && !keptFlags[idx] ? 'opacity-30' : ''}`}>
                    <img src={`/docs/api/projects/${projectId}/daily-reports/${report._id}/photos/${idx}`}
                      alt={`ภาพ ${idx+1}`} className="w-full h-36 object-cover rounded-lg bg-gray-100" />
                    {editMode && (
                      <button type="button"
                        onClick={() => { const f=[...keptFlags]; f[idx]=!f[idx]; setKeptFlags(f); }}
                        className={`absolute top-1 right-1 rounded-full w-6 h-6 text-xs font-bold flex items-center justify-center shadow ${keptFlags[idx] ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {keptFlags[idx] ? '✕' : '↩'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* เพิ่มรูปใหม่ (edit mode) */}
            {editMode && (
              <div className="space-y-2">
                <PhotoInputGroup
                  disabled={totalPhotoCount >= 6}
                  onAddFiles={(files) => {
                    setNewPhotoFiles((prev) => {
                      const merged = [...prev, ...files];
                      const available = 6 - keptFlags.filter(Boolean).length;
                      return merged.slice(0, Math.max(0, available));
                    });
                  }}
                />
                {totalPhotoCount >= 6 && <p className="text-xs text-amber-600">ครบ 6 รูปแล้ว</p>}
                <ImgPreviews
                  files={newPhotoFiles}
                  onRemove={(i) => setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </div>
            )}
          </div>

          {/* ปุ่ม save/cancel */}
          {editMode && (
            <div className="space-y-2">
              {uploading && <UploadProgress progress={progress} />}
              <div className="flex justify-end gap-2">
                <button onClick={cancelEdit}
                  className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving}
                  className="text-sm bg-primary text-white rounded-lg px-4 py-1.5 hover:bg-orange-600 disabled:opacity-50">
                  {saving ? (uploading ? `กำลัง upload... ${progress}%` : 'กำลังบันทึก...') : 'บันทึก'}
                </button>
              </div>
            </div>
          )}

          {/* ครุภัณฑ์ */}
          {report.equipment_items?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">รายละเอียดครุภัณฑ์</p>
              <div className="space-y-2">
                {report.equipment_items.map((eq, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    {eq.photo && (
                      <img src={`/docs/api/projects/${projectId}/daily-reports/${report._id}/equip-photos/${idx}`}
                        alt="ครุภัณฑ์" className="w-16 h-16 object-cover rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="text-sm">
                      {eq.equipment_type && <p className="font-medium">{eq.equipment_type}</p>}
                      {eq.equipment_no && <p className="text-gray-600 text-xs">เลขครุภัณฑ์: {eq.equipment_no}</p>}
                      {eq.serial_no && <p className="text-gray-500 text-xs">Serial: {eq.serial_no}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ลบ */}
          {!editMode && (
            <div className="border-t pt-3">
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                {deleting ? 'กำลังลบ...' : '🗑 ลบรายงานนี้'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── CreateReportModal ──────────────────────────────────── */

function CreateReportModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({
    report_date: today(),
    morning_description: '',
    afternoon_description: '',
    position: '',
    weatherSelect: 'ท้องฟ้าแจ่มใส',
    weatherCustom: '',
    obstacles: '',
    other_instructions: '',
    engineer_count: '',
    foreman_count: '',
    laborer_count: '',
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [equipItems, setEquipItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [procItems, setProcItems] = useState([]);
  const [usedEquipNos, setUsedEquipNos] = useState(new Set());
  const [loadingProc, setLoadingProc] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${projectId}/procurement`),
      api.get(`/projects/${projectId}/used-equipment-nos`),
    ])
      .then(([procRes, usedRes]) => {
        setProcItems(procRes.data.data || []);
        setUsedEquipNos(new Set(usedRes.data.data || []));
      })
      .catch(() => {})
      .finally(() => setLoadingProc(false));
  }, [projectId]);

  const equipOptions = [];
  procItems.filter((p) => p.item_type === 'equipment').forEach((p) => {
    if (p.equipment_serial_list?.length > 0) {
      p.equipment_serial_list.forEach((eq) => {
        // ซ่อนรายการที่ถูกใช้ในรายงานประจำวันแล้ว (equipment_no ไม่ว่าง)
        if (eq.equipment_no && usedEquipNos.has(eq.equipment_no)) return;
        equipOptions.push({
          label: `${eq.equipment_no || '(ไม่มีเลข)'}${p.description ? ' — ' + p.description : ''}`,
          value: { equipment_type: p.description || '', equipment_no: eq.equipment_no || '', serial_no: eq.serial_no || '' },
        });
      });
    } else {
      if (p.equipment_no && usedEquipNos.has(p.equipment_no)) return;
      equipOptions.push({
        label: p.equipment_no ? `${p.equipment_no} — ${p.description}` : p.description,
        value: { equipment_type: p.description || '', equipment_no: p.equipment_no || '', serial_no: '' },
      });
    }
  });
  const hasEquipOptions = equipOptions.length > 0;

  const addEquipItem = () => setEquipItems((p) => [...p, { equipment_type: '', equipment_no: '', serial_no: '', photoFile: null }]);
  const removeEquipItem = (idx) => setEquipItems((p) => p.filter((_, i) => i !== idx));

  const handleEquipSelect = (idx, val) => {
    if (!val) return;
    try {
      const parsed = JSON.parse(val);
      const updated = [...equipItems];
      updated[idx] = { ...updated[idx], ...parsed };
      setEquipItems(updated);
    } catch {}
  };

  const addPhotos = (files) => setPhotoFiles((prev) => [...prev, ...files].slice(0, 6));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.morning_description.trim()) { toast.error('กรุณาระบุรายละเอียดการทำงานภาคเช้า'); return; }

    const finalWeather = form.weatherSelect === 'other' ? form.weatherCustom : form.weatherSelect;
    if (form.weatherSelect === 'other' && !form.weatherCustom.trim()) {
      toast.error('กรุณาระบุสภาพภูมิอากาศอื่น ๆ');
      return;
    }

    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('report_date', form.report_date);
      fd.append('morning_description', form.morning_description);
      fd.append('afternoon_description', form.afternoon_description);
      fd.append('position', form.position);
      fd.append('weather', finalWeather);
      fd.append('obstacles', form.obstacles.trim() || '---');
      fd.append('other_instructions', form.other_instructions.trim() || '---');
      fd.append('engineer_count', Number(form.engineer_count) || 0);
      fd.append('foreman_count', Number(form.foreman_count) || 0);
      fd.append('laborer_count', Number(form.laborer_count) || 0);

      photoFiles.forEach((f) => fd.append('photos', f));
      const validEquip = equipItems.filter((e) => e.equipment_type.trim() || e.equipment_no.trim());
      fd.append('equipment_items', JSON.stringify(validEquip.map((e) => ({ equipment_type: e.equipment_type, equipment_no: e.equipment_no, serial_no: e.serial_no }))));
      validEquip.forEach((e) => { if (e.photoFile) fd.append('equip_photos', e.photoFile); });

      await api.post(`/projects/${projectId}/daily-reports`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
      });
      toast.success('บันทึกรายงานประจำวันแล้ว');
      onCreated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">บันทึกรายงานประจำวัน</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ <span className="text-red-500">*</span></label>
              <input type="date" value={form.report_date}
                onChange={(e) => setForm((f) => ({ ...f, report_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่</label>
              <input type="text" value={form.position} placeholder="ระบุสถานที่ปฏิบัติงาน"
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* สภาพภูมิอากาศ */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">สภาพภูมิอากาศ</label>
              <select
                value={form.weatherSelect}
                onChange={(e) => setForm((f) => ({ ...f, weatherSelect: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {WEATHER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="other">อื่น ๆ</option>
              </select>
              {form.weatherSelect === 'other' && (
                <input
                  type="text"
                  placeholder="ระบุสภาพภูมิอากาศ (จำเป็นต้องกรอก)"
                  value={form.weatherCustom}
                  onChange={(e) => setForm((f) => ({ ...f, weatherCustom: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>

            {/* จำนวนบุคลากร */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนบุคลากร</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">วิศวกร/ช่าง (คน)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.engineer_count}
                    onChange={(e) => setForm((f) => ({ ...f, engineer_count: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">หัวหน้าคนงาน (คน)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.foreman_count}
                    onChange={(e) => setForm((f) => ({ ...f, foreman_count: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">กรรมกร (คน)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.laborer_count}
                    onChange={(e) => setForm((f) => ({ ...f, laborer_count: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* ปัญหา/อุปสรรค */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ปัญหา/อุปสรรค</label>
              <input
                type="text"
                placeholder="ปัญหา/อุปสรรค (ไม่บังคับกรอก Default = ---)"
                value={form.obstacles}
                onChange={(e) => setForm((f) => ({ ...f, obstacles: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* อื่น ๆ (การสั่งการ หรือการแก้ไข) */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">อื่น ๆ (การสั่งการ หรือการแก้ไข)</label>
              <input
                type="text"
                placeholder="การสั่งการ หรือการแก้ไข (ไม่บังคับกรอก Default = ---)"
                value={form.other_instructions}
                onChange={(e) => setForm((f) => ({ ...f, other_instructions: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ภาคเช้า <span className="text-red-500">*</span></label>
              <textarea rows={4} value={form.morning_description}
                onChange={(e) => setForm((f) => ({ ...f, morning_description: e.target.value }))}
                placeholder="รายละเอียดงานภาคเช้า..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ภาคบ่าย</label>
              <textarea rows={4} value={form.afternoon_description}
                onChange={(e) => setForm((f) => ({ ...f, afternoon_description: e.target.value }))}
                placeholder="รายละเอียดงานภาคบ่าย..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
            </div>
          </div>

          {/* ภาพถ่ายการปฏิบัติงาน */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ภาพถ่ายการปฏิบัติงาน (สูงสุด 6 รูป) <span className="text-gray-400 font-normal">{photoFiles.length}/6</span>
            </label>
            <PhotoInputGroup disabled={photoFiles.length >= 6} onAddFiles={addPhotos} />
            <ImgPreviews
              files={photoFiles}
              onRemove={(i) => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          {/* ครุภัณฑ์ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">รายละเอียดครุภัณฑ์ (ถ้ามี)</label>
              <button type="button" onClick={addEquipItem}
                className="text-xs text-primary border border-primary rounded px-2 py-0.5 hover:bg-orange-50">+ เพิ่ม</button>
            </div>
            {equipItems.length > 0 && !loadingProc && !hasEquipOptions && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                ⚠ ยังไม่มีรายการครุภัณฑ์ในระบบส่งมอบพัสดุ
              </p>
            )}
            {equipItems.map((eq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3 mb-2 space-y-2">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    {hasEquipOptions ? (
                      <>
                        <select
                          value={eq.equipment_no ? JSON.stringify({ equipment_type: eq.equipment_type, equipment_no: eq.equipment_no, serial_no: eq.serial_no }) : ''}
                          onChange={(e) => handleEquipSelect(idx, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30">
                          <option value="">-- เลือกครุภัณฑ์ --</option>
                          {equipOptions.map((opt, i) => (
                            <option key={i} value={JSON.stringify(opt.value)}>{opt.label}</option>
                          ))}
                        </select>
                        {eq.equipment_no && (
                          <p className="text-xs text-gray-500">
                            เลขครุภัณฑ์: {eq.equipment_no}{eq.serial_no ? ` | Serial: ${eq.serial_no}` : ''}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <input type="text" placeholder="ประเภท/ชื่อครุภัณฑ์ *" value={eq.equipment_type}
                          onChange={(e) => { const u=[...equipItems]; u[idx]={...eq,equipment_type:e.target.value}; setEquipItems(u); }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                        <input type="text" placeholder="เลขครุภัณฑ์" value={eq.equipment_no}
                          onChange={(e) => { const u=[...equipItems]; u[idx]={...eq,equipment_no:e.target.value}; setEquipItems(u); }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </>
                    )}
                  </div>
                  <button type="button" onClick={() => removeEquipItem(idx)} className="text-red-400 hover:text-red-600 text-sm px-1 mt-1">✕</button>
                </div>
                <div>
                  <label className="text-xs text-gray-500">ภาพถ่ายครุภัณฑ์</label>
                  <div className="mt-1">
                    <PhotoInputGroup multiple={false}
                      onAddFiles={(files) => { const u=[...equipItems]; u[idx]={...eq,photoFile:files[0]||null}; setEquipItems(u); }} />
                    {eq.photoFile && <ImgPreviews files={[eq.photoFile]} onRemove={() => { const u=[...equipItems]; u[idx]={...eq,photoFile:null}; setEquipItems(u); }} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {loading && <UploadProgress progress={progress} />}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {loading ? `กำลัง upload... ${progress}%` : 'บันทึกรายงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */

export default function ProjectDailyReports() {
  const { projectId } = useParams();
  const { project } = useOutletContext();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewReport, setViewReport] = useState(null);

  const fetchReports = () => {
    setLoading(true);
    api.get(`/projects/${projectId}/daily-reports`)
      .then(({ data }) => setReports(data.data))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-700">รายงานประจำวัน</h2>
        {project.status === 'active' && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 transition">
            + บันทึกรายงาน
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">ยังไม่มีรายงานประจำวัน</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r._id} report={r} onView={setViewReport} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateReportModal projectId={projectId} onClose={() => setShowCreate(false)} onCreated={fetchReports} />
      )}
      {viewReport && (
        <ReportDetail report={viewReport} projectId={projectId} onClose={() => setViewReport(null)} onUpdated={fetchReports} />
      )}
    </div>
  );
}
