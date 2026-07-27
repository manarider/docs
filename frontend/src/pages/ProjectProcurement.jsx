import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PrintReportButton from '../components/PrintReportButton';

const today = () => new Date().toISOString().slice(0, 10);
const ITEM_TYPE_LABEL = { equipment: 'ครุภัณฑ์', material: 'วัสดุ', other: 'อื่นๆ' };

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

function ProcurementCard({ item, onView }) {
  const issued = item.issued_items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const remaining = item.quantity - issued;
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-2 ${item.item_type==='equipment'?'bg-purple-100 text-purple-700':item.item_type==='material'?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-600'}`}>
            {ITEM_TYPE_LABEL[item.item_type]}
          </span>
          <span className="font-semibold text-gray-700 text-sm">{item.description}</span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{new Date(item.receive_date).toLocaleDateString('th-TH')}</span>
      </div>
      <div className="flex gap-4 text-sm">
        <span className="text-gray-500">รับเข้า: <strong className="text-gray-800">{item.quantity}</strong></span>
        <span className="text-gray-500">เบิกจ่าย: <strong className="text-orange-600">{issued}</strong></span>
        <span className="text-gray-500">คงเหลือ: <strong className={remaining>0?'text-green-600':'text-red-600'}>{remaining}</strong></span>
      </div>
      {item.equipment_serial_list?.length > 0 && (
        <p className="text-xs text-purple-600">🔖 ครุภัณฑ์ {item.equipment_serial_list.length} รายการ</p>
      )}
      <button onClick={() => onView(item)} className="text-xs text-primary hover:underline">ดูรายละเอียด →</button>
    </div>
  );
}

function EquipListModal({ item, onClose }) {
  const list = item.equipment_serial_list || [];
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-bold text-gray-800">รายการครุภัณฑ์ — {item.description}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ไม่มีรายการครุภัณฑ์</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left pb-2 w-8">#</th><th className="text-left pb-2">หมายเลขครุภัณฑ์</th><th className="text-left pb-2">Serial No.</th></tr></thead>
              <tbody>
                {list.map((eq, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-gray-400">{i+1}</td>
                    <td className="py-2">{eq.equipment_no || <span className="text-gray-400 italic">ไม่ระบุ</span>}</td>
                    <td className="py-2 text-gray-500">{eq.serial_no || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcurementDetail({ item: initialItem, projectId, onClose, onUpdated }) {
  const [item, setItem] = useState(initialItem);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    description: initialItem.description || '',
    receive_date: initialItem.receive_date?.slice(0,10) || today(),
    equipment_serial_list: initialItem.equipment_serial_list || [],
  });
  const [showIssue, setShowIssue] = useState(false);
  const [showEquipList, setShowEquipList] = useState(false);
  const [issueForm, setIssueForm] = useState({ issued_date: today(), quantity: 1, purpose: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  const issued = item.issued_items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const remaining = item.quantity - issued;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        description: editForm.description,
        receive_date: editForm.receive_date,
        equipment_serial_list: JSON.stringify(editForm.equipment_serial_list),
      };
      const { data } = await api.patch(`/projects/${projectId}/procurement/${item._id}`, payload);
      setItem(data.data);
      setEditMode(false);
      toast.success('บันทึกแล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('ยืนยันลบรายการพัสดุนี้?')) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}/procurement/${item._id}`);
      toast.success('ลบแล้ว');
      onUpdated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
      setDeleting(false);
    }
  };

  const handleIssue = async () => {
    if (issueForm.quantity < 1) { toast.error('จำนวนต้องมากกว่า 0'); return; }
    setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/procurement/${item._id}/issue`, issueForm);
      setItem(data.data);
      setShowIssue(false);
      toast.success('บันทึกการเบิกจ่ายแล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  const updateSerialItem = (idx, field, val) => {
    const list = [...editForm.equipment_serial_list];
    list[idx] = { ...list[idx], [field]: val };
    setEditForm((f) => ({ ...f, equipment_serial_list: list }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">{item.description}</h3>
          <div className="flex gap-2 items-center">
            <PrintReportButton
              projectId={projectId}
              module="procurement"
              recordId={item._id}
              className="text-xs border border-primary text-primary rounded px-2 py-1 hover:bg-orange-50"
            />
            {!editMode && <button onClick={() => setEditMode(true)} className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">แก้ไข</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">ประเภท</dt><dd className="font-medium">{ITEM_TYPE_LABEL[item.item_type]}</dd></div>
            <div>
              <dt className="text-gray-500">วันที่รับ</dt>
              {editMode ? (
                <input type="date" value={editForm.receive_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, receive_date: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-0.5 text-sm w-full" />
              ) : (
                <dd className="font-medium">{new Date(item.receive_date).toLocaleDateString('th-TH')}</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500">รายละเอียด</dt>
              {editMode ? (
                <input type="text" value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-0.5 text-sm w-full" />
              ) : (
                <dd className="font-medium">{item.description}</dd>
              )}
            </div>
            <div><dt className="text-gray-500">จำนวนทั้งหมด</dt><dd className="font-medium">{item.quantity}</dd></div>
            <div><dt className="text-gray-500">เบิกจ่ายแล้ว</dt><dd className="font-medium text-orange-600">{issued}</dd></div>
            <div><dt className="text-gray-500">คงเหลือ</dt><dd className={`font-medium ${remaining>0?'text-green-600':'text-red-600'}`}>{remaining}</dd></div>
          </dl>

          {/* ปุ่มดูครุภัณฑ์ */}
          {item.item_type === 'equipment' && (
            <div>
              {editMode ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">รายการครุภัณฑ์ ({editForm.equipment_serial_list.length} รายการ)</p>
                  {editForm.equipment_serial_list.length === 0 ? (
                    <p className="text-xs text-gray-400">ไม่มีรายการ</p>
                  ) : (
                    <div className="space-y-2">
                      {editForm.equipment_serial_list.map((eq, i) => (
                        <div key={i} className="flex gap-2 items-center text-xs">
                          <span className="text-gray-400 w-5">{i+1}.</span>
                          <input placeholder="หมายเลขครุภัณฑ์" value={eq.equipment_no}
                            onChange={(e) => updateSerialItem(i, 'equipment_no', e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1" />
                          <input placeholder="Serial No." value={eq.serial_no}
                            onChange={(e) => updateSerialItem(i, 'serial_no', e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                item.equipment_serial_list?.length > 0 ? (
                  <button onClick={() => setShowEquipList(true)}
                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-200">
                    🔖 ดูครุภัณฑ์ ({item.equipment_serial_list.length} รายการ)
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 italic">ไม่มีรายการหมายเลขครุภัณฑ์</p>
                )
              )}
            </div>
          )}

          {editMode && (
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditMode(false); setEditForm({ description: item.description, receive_date: item.receive_date?.slice(0,10)||today(), equipment_serial_list: item.equipment_serial_list||[] }); }}
                className="text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm bg-primary text-white rounded-lg px-4 py-1.5 hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          )}

          {/* รูปภาพ */}
          {(item.receive_photos?.length > 0 || item.inspection_photos?.length > 0) && (
            <div className="space-y-3">
              {item.receive_photos?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">ภาพถ่ายการรับพัสดุ</p>
                  <div className="grid grid-cols-3 gap-2">
                    {item.receive_photos.map((_, idx) => (
                      <img key={idx} src={`/docs/api/projects/${projectId}/procurement/${item._id}/receive-photos/${idx}`}
                        alt="" className="w-full h-28 object-cover rounded-lg bg-gray-100" />
                    ))}
                  </div>
                </div>
              )}
              {item.inspection_photos?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">ภาพถ่ายการตรวจรับ</p>
                  <div className="grid grid-cols-3 gap-2">
                    {item.inspection_photos.map((_, idx) => (
                      <img key={idx} src={`/docs/api/projects/${projectId}/procurement/${item._id}/inspect-photos/${idx}`}
                        alt="" className="w-full h-28 object-cover rounded-lg bg-gray-100" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* เบิกจ่าย */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">ประวัติการเบิกจ่าย ({issued}/{item.quantity})</p>
              {remaining > 0 && !editMode && (
                <button onClick={() => setShowIssue(!showIssue)}
                  className="text-xs text-primary border border-primary rounded px-2 py-0.5 hover:bg-orange-50">+ เบิกจ่าย</button>
              )}
            </div>
            {showIssue && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">วันที่จ่าย *</label>
                    <input type="date" value={issueForm.issued_date}
                      onChange={(e) => setIssueForm((f) => ({ ...f, issued_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">จำนวน * (คงเหลือ {remaining})</label>
                    <input type="number" min={1} max={remaining} value={issueForm.quantity}
                      onChange={(e) => setIssueForm((f) => ({ ...f, quantity: parseInt(e.target.value,10)||1 }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5" />
                  </div>
                </div>
                <input type="text" placeholder="วัตถุประสงค์การเบิก" value={issueForm.purpose}
                  onChange={(e) => setIssueForm((f) => ({ ...f, purpose: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowIssue(false)} className="text-xs text-gray-500">ยกเลิก</button>
                  <button onClick={handleIssue} disabled={loading}
                    className="text-xs bg-primary text-white px-3 py-1 rounded disabled:opacity-50">
                    {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>
            )}
            {item.issued_items?.length > 0 ? (
              <div className="space-y-1">
                {item.issued_items.map((iss, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-500">{new Date(iss.issued_date).toLocaleDateString('th-TH')}</span>
                    <span className="font-medium text-orange-600">−{iss.quantity}</span>
                    {iss.purpose && <span className="text-gray-500 flex-1 truncate">{iss.purpose}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">ยังไม่มีการเบิกจ่าย</p>
            )}
          </div>

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
      {showEquipList && <EquipListModal item={item} onClose={() => setShowEquipList(false)} />}
    </div>
  );
}

function CreateProcurementModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ receive_date: today(), item_type: 'equipment', description: '', quantity: 1 });
  const [receivePhotos, setReceivePhotos] = useState([]);
  const [equipSerialList, setEquipSerialList] = useState([]);
  const [showEquipManage, setShowEquipManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // sync equipSerialList length with quantity when type=equipment
  useEffect(() => {
    if (form.item_type !== 'equipment') { setEquipSerialList([]); setShowEquipManage(false); return; }
    const qty = Math.max(1, parseInt(form.quantity, 10) || 1);
    setEquipSerialList((prev) => {
      if (prev.length === qty) return prev;
      if (prev.length < qty) return [...prev, ...Array(qty - prev.length).fill({ serial_no: '', equipment_no: '' })];
      return prev.slice(0, qty);
    });
  }, [form.quantity, form.item_type]);

  const updateSerialItem = (idx, field, val) => {
    setEquipSerialList((prev) => { const l=[...prev]; l[idx]={...l[idx],[field]:val}; return l; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('กรุณาระบุรายละเอียดพัสดุ'); return; }
    setLoading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('receive_date', form.receive_date);
      fd.append('item_type', form.item_type);
      fd.append('description', form.description);
      fd.append('quantity', form.quantity);
      if (form.item_type === 'equipment' && equipSerialList.length > 0) {
        fd.append('equipment_serial_list', JSON.stringify(equipSerialList));
      }
      receivePhotos.forEach((f) => fd.append('receive_photos', f));

      await api.post(`/projects/${projectId}/procurement`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
      });
      toast.success('บันทึกการรับพัสดุแล้ว');
      onCreated(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => setForm((f) => ({ ...f, [field]: e.target.value })),
    className: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">บันทึกการรับพัสดุ</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับ *</label>
              <input type="date" {...inp('receive_date')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท *</label>
              <select {...inp('item_type')}>
                <option value="equipment">ครุภัณฑ์</option>
                <option value="material">วัสดุ</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด *</label>
            <input type="text" placeholder="ชื่อ/รายละเอียดพัสดุ" {...inp('description')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน *</label>
            <div className="flex gap-3 items-start">
              <input type="number" min={1} {...inp('quantity')} className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {form.item_type === 'equipment' && parseInt(form.quantity,10) > 0 && (
                <button type="button"
                  onClick={() => setShowEquipManage(!showEquipManage)}
                  className={`text-xs px-3 py-2 rounded-lg border transition ${showEquipManage ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  🔖 จัดการหมายเลขครุภัณฑ์
                </button>
              )}
            </div>
          </div>

          {form.item_type === 'equipment' && showEquipManage && (
            <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-purple-700">หมายเลขครุภัณฑ์ ({equipSerialList.length} รายการ)</p>
              <div className="grid grid-cols-5 gap-1 text-xs text-gray-500 font-medium px-1">
                <span>#</span><span className="col-span-2">หมายเลขครุภัณฑ์</span><span className="col-span-2">Serial No.</span>
              </div>
              {equipSerialList.map((eq, i) => (
                <div key={i} className="grid grid-cols-5 gap-1 items-center">
                  <span className="text-xs text-gray-400 pl-1">{i+1}.</span>
                  <input placeholder="เลขครุภัณฑ์" value={eq.equipment_no}
                    onChange={(e) => updateSerialItem(i, 'equipment_no', e.target.value)}
                    className="col-span-2 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300" />
                  <input placeholder="Serial No." value={eq.serial_no}
                    onChange={(e) => updateSerialItem(i, 'serial_no', e.target.value)}
                    className="col-span-2 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-300" />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ภาพถ่ายการรับพัสดุ</label>
            <PhotoInputGroup
              onAddFiles={(files) => setReceivePhotos((prev) => [...prev, ...files])}
            />
            <ImgPreviews files={receivePhotos} />
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

export default function ProjectProcurement() {
  const { projectId } = useParams();
  const { project } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const { currentRole } = useOutletContext();
  const canWrite = ['supervisor', 'internal'].includes(currentRole);

  const fetchItems = () => {
    setLoading(true);
    api.get(`/projects/${projectId}/procurement`)
      .then(({ data }) => setItems(data.data))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-700">ระบบส่งมอบพัสดุ</h2>
        {canWrite && project.status === 'active' && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 transition">
            + บันทึกการรับพัสดุ
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">ยังไม่มีรายการพัสดุ</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ProcurementCard key={item._id} item={item} onView={setViewItem} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProcurementModal projectId={projectId} onClose={() => setShowCreate(false)} onCreated={fetchItems} />
      )}
      {viewItem && (
        <ProcurementDetail item={viewItem} projectId={projectId} onClose={() => setViewItem(null)} onUpdated={fetchItems} />
      )}
    </div>
  );
}
