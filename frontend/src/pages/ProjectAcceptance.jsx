import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PrintReportButton from '../components/PrintReportButton';

const today = () => new Date().toISOString().slice(0, 10);

function ImgPreviews({ files }) {
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
        <img key={i} src={u} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
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
  const base = `cursor-pointer inline-flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 select-none transition ${
    disabled ? 'opacity-50 pointer-events-none' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
  }`;
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

function AcceptanceCard({ item, onView }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700">
          {new Date(item.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}
        </span>
        <span className="text-xs text-gray-400">{item.accepted_role}</span>
      </div>
      {item.notes && <p className="text-sm text-gray-600 line-clamp-2">{item.notes}</p>}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {item.inspection_photos?.length > 0 && <span>📷 {item.inspection_photos.length} รูป</span>}
        {item.delivery_doc_sub_id && <span>📎 มีเอกสารส่งมอบ</span>}
      </div>
      <button onClick={() => onView(item)} className="text-xs text-primary hover:underline">ดูรายละเอียด →</button>
    </div>
  );
}

function AcceptanceDetail({ item: init, projectId, onClose, onUpdated }) {
  const [item, setItem] = useState(init);
  const [editMode, setEditMode] = useState(false);
  const [editNotes, setEditNotes] = useState(init.notes || '');
  const [addPhotoFiles, setAddPhotoFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setProgress(0);
    try {
      let res;
      if (addPhotoFiles.length > 0) {
        setUploading(true);
        const fd = new FormData();
        fd.append('notes', editNotes);
        addPhotoFiles.forEach((f) => fd.append('inspection_photos', f));
        const r = await api.patch(`/projects/${projectId}/acceptance/${item._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
        });
        res = r;
        setUploading(false);
      } else {
        res = await api.patch(`/projects/${projectId}/acceptance/${item._id}`, { notes: editNotes });
      }
      setItem(res.data.data);
      setEditMode(false);
      setAddPhotoFiles([]);
      toast.success('บันทึกแล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
      setUploading(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('ยืนยันลบรายการตรวจรับนี้?')) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/acceptance/${item._id}`);
      toast.success('ลบแล้ว');
      onUpdated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
      setDeleting(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditNotes(item.notes || '');
    setAddPhotoFiles([]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">
            ตรวจรับงาน: {new Date(item.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}
          </h3>
          <div className="flex gap-2 items-center">
            <PrintReportButton
              projectId={projectId}
              module="acceptance"
              recordId={item._id}
              className="text-xs border border-primary text-primary rounded px-2 py-1 hover:bg-orange-50"
            />
            {!editMode && (
              <button onClick={() => setEditMode(true)} className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">แก้ไข</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* หมายเหตุ */}
          <div>
            <p className="text-xs text-gray-500 mb-1">หมายเหตุ/สรุปผล</p>
            {editMode ? (
              <textarea rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
            ) : (
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-line">
                {item.notes || <span className="text-gray-400 italic">ไม่มีหมายเหตุ</span>}
              </p>
            )}
          </div>

          {/* เพิ่มรูปภาพในโหมดแก้ไข */}
          {editMode && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">เพิ่มภาพถ่าย</label>
              <PhotoInputGroup
                onAddFiles={(files) => setAddPhotoFiles((prev) => [...prev, ...files])}
              />
              <ImgPreviews files={addPhotoFiles} />
            </div>
          )}

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

          {/* เอกสารส่งมอบ */}
          {item.delivery_doc_sub_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium mb-1">📎 เอกสารส่งมอบ</p>
              <p className="text-sm text-blue-800">{item.delivery_doc_title || 'เอกสารแนบ'}</p>
              <p className="text-xs text-blue-500 mt-0.5">บันทึกในเอกสารโครงการเรียบร้อยแล้ว</p>
            </div>
          )}

          {/* รูปตรวจรับ */}
          {item.inspection_photos?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">ภาพถ่ายการตรวจรับ ({item.inspection_photos.length} รูป)</p>
              <div className="grid grid-cols-3 gap-2">
                {item.inspection_photos.map((_, idx) => (
                  <img key={idx}
                    src={`/docs/api/projects/${projectId}/acceptance/${item._id}/photos/${idx}`}
                    alt="" className="w-full h-28 object-cover rounded-lg bg-gray-100" />
                ))}
              </div>
            </div>
          )}

          {!editMode && (
            <div className="border-t pt-3">
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                {deleting ? 'กำลังลบ...' : '🗑 ลบรายการนี้'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateAcceptanceModal({ projectId, onClose, onCreated }) {
  const [notes, setNotes] = useState('');
  const [inspectPhotos, setInspectPhotos] = useState([]);
  const [deliveryDoc, setDeliveryDoc] = useState(null);
  const [deliveryDocTitle, setDeliveryDocTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('notes', notes);
      inspectPhotos.forEach((f) => fd.append('inspection_photos', f));
      if (deliveryDoc && deliveryDocTitle.trim()) {
        fd.append('delivery_doc', deliveryDoc);
        fd.append('delivery_doc_title', deliveryDocTitle.trim());
      }

      await api.post(`/projects/${projectId}/acceptance`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
      });
      toast.success('บันทึกการตรวจรับงานแล้ว');
      onCreated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">บันทึกการตรวจรับงาน</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ภาพถ่ายการตรวจรับ</label>
            <PhotoInputGroup
              onAddFiles={(files) => setInspectPhotos((prev) => [...prev, ...files])}
            />
            <ImgPreviews files={inspectPhotos} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ/สรุปผลการตรวจรับ</label>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="สรุปผลการตรวจรับงาน..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">เอกสารการส่งมอบ (ไม่บังคับ)</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อเอกสาร</label>
              <input type="text" value={deliveryDocTitle} onChange={(e) => setDeliveryDocTitle(e.target.value)}
                placeholder="เช่น รายงานการส่งมอบงานงวดที่ 1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ไฟล์เอกสาร (PDF/Word)</label>
              <input type="file" accept=".pdf,.doc,.docx"
                onChange={(e) => setDeliveryDoc(e.target.files[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded-lg file:text-sm file:bg-gray-50" />
            </div>
            {deliveryDoc && !deliveryDocTitle.trim() && (
              <p className="text-xs text-amber-600">⚠ กรุณาระบุชื่อเอกสารด้วย</p>
            )}
          </div>

          {loading && <UploadProgress progress={progress} />}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {loading ? `กำลัง upload... ${progress}%` : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectAcceptance() {
  const { projectId } = useParams();
  const { project, currentRole } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const canWrite = ['supervisor', 'project_manager', 'internal'].includes(currentRole);

  const fetchItems = () => {
    setLoading(true);
    api.get(`/projects/${projectId}/acceptance`)
      .then(({ data }) => setItems(data.data))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-700">ระบบตรวจรับงาน</h2>
        {canWrite && project.status === 'active' && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 transition">
            + บันทึกการตรวจรับ
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">ยังไม่มีรายการตรวจรับงาน</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AcceptanceCard key={item._id} item={item} onView={setViewItem} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAcceptanceModal projectId={projectId} onClose={() => setShowCreate(false)} onCreated={fetchItems} />
      )}
      {viewItem && (
        <AcceptanceDetail item={viewItem} projectId={projectId} onClose={() => setViewItem(null)} onUpdated={fetchItems} />
      )}
    </div>
  );
}
