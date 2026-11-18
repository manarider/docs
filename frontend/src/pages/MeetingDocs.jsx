import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, staff: 25, member: 20, viewer: 10 };

function emptyFileEntry() {
  return { entry_type: 'file', sub_title: '', file: null };
}
function emptyGoogleEntry() {
  return { entry_type: 'google', sub_title: '', google_url: '' };
}

/** แปลง ISO string → ค่าที่ใช้กับ <input type="datetime-local"> (เวลาท้องถิ่น) */
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingDocs() {
  const { user } = useAuth();
  const canManage = (ROLE_LEVEL[user?.role] || 0) >= ROLE_LEVEL.member;

  const [tab, setTab] = useState('docs'); // 'docs' | 'schedule'
  const [meetType, setMeetType] = useState(null);

  useEffect(() => {
    api.get('/meetings/doctype')
      .then(({ data }) => setMeetType(data.data))
      .catch(() => toast.error('โหลดประเภทเอกสารประชุมไม่สำเร็จ'));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">MeetingDocs — จัดการเอกสารประชุม</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          จัดการเอกสารและกำหนดช่วงเวลาแสดงผลสำหรับหน้าจอประชุม (มือถือ/แท็บเล็ต) ที่{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/docs/meet</code>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('docs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'docs' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >📄 จัดการเอกสารประชุม</button>
        <button
          onClick={() => setTab('schedule')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'schedule' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >🗓️ จัดการการแสดงผล</button>
      </div>

      {tab === 'docs' ? (
        <MeetingDocsTab meetType={meetType} canManage={canManage} />
      ) : (
        <MeetingScheduleTab meetType={meetType} canManage={canManage} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: จัดการเอกสารประชุม
// ─────────────────────────────────────────────────────────────────────────────
function MeetingDocsTab({ meetType, canManage }) {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [view, setView] = useState('list'); // 'list' | 'new'
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadDocs = useCallback(() => {
    if (!meetType?._id) return;
    setLoading(true);
    api.get(`/documents?type=${meetType._id}&page=${page}&limit=${limit}`)
      .then(({ data }) => {
        setDocs(data.data);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => toast.error('โหลดเอกสารประชุมไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [meetType, page]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const totalPages = Math.ceil(total / limit);

  if (view === 'new') {
    return (
      <MeetingDocNew
        meetType={meetType}
        isAdmin={isAdmin}
        onDone={() => { setView('list'); setPage(1); loadDocs(); }}
        onCancel={() => setView('list')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">แสดงเฉพาะเอกสารประเภทเอกสารประชุม — ทุกคนมองเห็นได้ เรียงใหม่ล่าสุดก่อน</p>
        {canManage && (
          <button
            onClick={() => setView('new')}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition shrink-0"
          >+ เพิ่มเอกสารประชุมใหม่</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">ยังไม่มีเอกสารประชุม</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">ชื่อเอกสาร</th>
                <th className="text-center px-4 py-3 font-medium">ไฟล์แนบ</th>
                <th className="text-center px-4 py-3 font-medium">วันที่เพิ่ม</th>
                <th className="text-right px-4 py-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc._id} className="hover:bg-orange-50 transition">
                  <td className="px-4 py-3">
                    <Link to={`/documents/${doc._id}`} className="text-primary font-medium hover:underline">
                      {doc.title}
                    </Link>
                    {doc.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{doc.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">
                      {doc.attachments?.length || 0} ไฟล์
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs text-center">
                    {new Date(doc.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/documents/${doc._id}/edit`} className="text-xs text-blue-600 hover:underline">
                      แก้ไข / แชร์ / QR
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">ทั้งหมด {total} รายการ</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40">ก่อนหน้า</button>
                <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingDocNew({ meetType, isAdmin, onDone, onCancel }) {
  const { user } = useAuth();
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', dept_id: '' });
  const [files, setFiles] = useState([emptyFileEntry()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/departments').then(({ data }) => {
      const deptList = data.data;
      setDepts(deptList);
      if (!isAdmin && user?.subDepartment) {
        const myDept = deptList.find((d) => d.name === user.subDepartment || d._id === user.subDepartment);
        if (myDept) setForm((f) => ({ ...f, dept_id: myDept._id }));
      }
    }).catch(() => toast.error('โหลดหน่วยงานไม่สำเร็จ'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFileField = (idx, field, val) =>
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  const addFileEntry = () => setFiles((prev) => [...prev, emptyFileEntry()]);
  const addGoogleEntry = () => setFiles((prev) => [...prev, emptyGoogleEntry()]);
  const removeEntry = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('กรุณาระบุชื่อเอกสาร');
    if (!form.dept_id) return toast.error('กรุณาเลือกหน่วยงาน');
    if (!meetType?._id) return toast.error('ไม่พบประเภทเอกสารประชุม');

    const validEntries = files.filter((f) =>
      (f.entry_type === 'file' && f.file) || (f.entry_type === 'google' && f.google_url.trim())
    );
    if (validEntries.length === 0) return toast.error('กรุณาแนบไฟล์ PDF หรือลิงก์ Google อย่างน้อย 1 รายการ');
    for (const f of files) {
      if (f.entry_type === 'file' && f.file) {
        if (!f.sub_title.trim()) return toast.error('กรุณาระบุชื่อไฟล์แนบทุกรายการ');
        if (f.file.type !== 'application/pdf' && !f.file.name.toLowerCase().endsWith('.pdf')) {
          return toast.error('เอกสารประชุมรองรับเฉพาะไฟล์ PDF เท่านั้น');
        }
      }
      if (f.entry_type === 'google' && f.google_url.trim() && !f.sub_title.trim()) {
        return toast.error('กรุณาระบุชื่อลิงก์ Google ทุกรายการ');
      }
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/documents', {
        title: form.title, description: form.description, dept_id: form.dept_id, type_id: meetType._id,
      });
      const docId = data.data._id;

      for (const f of files) {
        if (f.entry_type === 'file' && f.file) {
          const fd = new FormData();
          fd.append('file', f.file);
          fd.append('sub_title', f.sub_title.trim());
          await api.post(`/documents/${docId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else if (f.entry_type === 'google' && f.google_url.trim()) {
          await api.post(`/documents/${docId}/attachments/url`, {
            sub_title: f.sub_title.trim(), source_url: f.google_url.trim(),
          });
        }
      }

      toast.success('เพิ่มเอกสารประชุมเรียบร้อย');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
      <h3 className="font-bold text-gray-800">เพิ่มเอกสารประชุมใหม่</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเอกสาร <span className="text-red-500">*</span></label>
        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputClass} placeholder="เช่น: วาระการประชุมคณะกรรมการ ครั้งที่ 1/2569" maxLength={1000} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หน่วยงาน <span className="text-red-500">*</span></label>
          {isAdmin ? (
            <select value={form.dept_id} onChange={(e) => setForm({ ...form, dept_id: e.target.value })} className={inputClass}>
              <option value="">-- เลือกหน่วยงาน --</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          ) : (
            <input readOnly value={depts.find((d) => d._id === form.dept_id)?.name || 'กำลังโหลด...'}
              className={`${inputClass} bg-gray-50 text-gray-600 cursor-not-allowed`} />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเอกสาร</label>
          <input readOnly value={meetType?.name || 'เอกสารประชุม'}
            className={`${inputClass} bg-gray-50 text-gray-600 cursor-not-allowed`} />
          <p className="text-xs text-gray-400 mt-0.5">ไม่สามารถเปลี่ยนประเภทได้</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={inputClass} rows={3} maxLength={2000} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" />
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              ไฟล์แนบ <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(บังคับอย่างน้อย 1 รายการ)</span>
            </p>
            <p className="text-xs text-blue-600 mt-0.5">รองรับเฉพาะ PDF และลิงก์ Google Docs/Sheets เท่านั้น</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addFileEntry}
              className="flex items-center gap-1 text-primary border border-primary px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition">+ เพิ่ม PDF</button>
            <button type="button" onClick={addGoogleEntry}
              className="flex items-center gap-1 text-blue-600 border border-blue-400 px-3 py-1 rounded-lg text-xs hover:bg-blue-50 transition">+ Google Link</button>
          </div>
        </div>

        {files.map((f, idx) => (
          <div key={idx} className={`border rounded-lg p-3 space-y-2 ${f.entry_type === 'google' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {f.entry_type === 'google' ? '🔗 ลิงก์ Google ที่ ' : '📄 PDF ที่ '}{idx + 1}
              </span>
              {files.length > 1 && (
                <button type="button" onClick={() => removeEntry(idx)} className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อเอกสารย่อย <span className="text-red-500">*</span></label>
              <input type="text" value={f.sub_title} onChange={(e) => setFileField(idx, 'sub_title', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={f.entry_type === 'google' ? 'เช่น: สไลด์ประกอบการประชุม' : 'เช่น: วาระการประชุม'} maxLength={500} />
            </div>
            {f.entry_type === 'file' ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เลือกไฟล์ PDF</label>
                <input type="file" accept=".pdf,application/pdf" onChange={(e) => setFileField(idx, 'file', e.target.files[0] || null)}
                  className="text-sm text-gray-600" />
                {f.file && <p className="text-xs text-gray-400 mt-1">{f.file.name} ({(f.file.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL Google Docs / Google Sheets</label>
                <input type="url" value={f.google_url} onChange={(e) => setFileField(idx, 'google_url', e.target.value)}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="https://docs.google.com/document/... หรือ spreadsheets/..." />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={submitting}
          className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
          {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40">ยกเลิก</button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: จัดการการแสดงผล (คิวเวลาแสดงเอกสารประชุม)
// ─────────────────────────────────────────────────────────────────────────────
function MeetingScheduleTab({ meetType, canManage }) {
  const [status, setStatus] = useState('active'); // 'active' | 'history'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]); // รายการเอกสารประชุมทั้งหมด สำหรับเลือกในฟอร์ม
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editing, setEditing] = useState(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    api.get(`/meetings?status=${status}&limit=50`)
      .then(({ data }) => setItems(data.data))
      .catch(() => toast.error('โหลดคิวการแสดงผลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    if (!meetType?._id) return;
    api.get(`/documents?type=${meetType._id}&limit=100`)
      .then(({ data }) => setDocs(data.data))
      .catch(() => {});
  }, [meetType]);

  const handleDelete = async (id) => {
    if (!window.confirm('ยืนยันการลบคิวการแสดงผลนี้?')) return;
    try {
      await api.delete(`/meetings/${id}`);
      toast.success('ลบคิวการแสดงผลเรียบร้อย');
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  if (view === 'form') {
    return (
      <MeetingScheduleForm
        docs={docs}
        editing={editing}
        onDone={() => { setView('list'); setEditing(null); loadItems(); }}
        onCancel={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button onClick={() => setStatus('active')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${status === 'active' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >กำลังแสดง / คิวล่วงหน้า</button>
          <button onClick={() => setStatus('history')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${status === 'history' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >ประวัติ</button>
        </div>
        {canManage && status === 'active' && (
          <button onClick={() => setView('form')}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >+ เพิ่มคิวการแสดงผล</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">
          {status === 'active' ? 'ยังไม่มีคิวการแสดงผล' : 'ยังไม่มีประวัติ'}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const now = Date.now();
            const isLive = new Date(m.starts_at).getTime() <= now && now <= new Date(m.ends_at).getTime();
            return (
              <div key={m._id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isLive && status === 'active' && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">● กำลังแสดงผล</span>
                      )}
                      <p className="font-semibold text-gray-800">
                        {m.description || m.documents?.map((d) => d.title).join(', ') || '(ไม่มีรายละเอียด)'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(m.starts_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                      {' — '}
                      {new Date(m.ends_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(m.documents || []).map((d) => (
                        <span key={d._id} className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{d.title}</span>
                      ))}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      {status === 'active' && (
                        <button onClick={() => { setEditing(m); setView('form'); }}
                          className="text-xs text-blue-600 hover:underline">แก้ไข</button>
                      )}
                      <button onClick={() => handleDelete(m._id)} className="text-xs text-red-500 hover:underline">ลบ</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MeetingScheduleForm({ docs, editing, onDone, onCancel }) {
  const [selected, setSelected] = useState(() => new Set((editing?.documents || []).map((d) => d._id)));
  const [description, setDescription] = useState(editing?.description || '');
  const [startsAt, setStartsAt] = useState(toLocalInputValue(editing?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(editing?.ends_at));
  const [submitting, setSubmitting] = useState(false);

  const toggleDoc = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.size === 0) return toast.error('กรุณาเลือกเอกสารประชุมอย่างน้อย 1 รายการ');
    if (!startsAt || !endsAt) return toast.error('กรุณาระบุวันเวลาเริ่มต้นและสิ้นสุด');
    if (new Date(endsAt) <= new Date(startsAt)) return toast.error('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');

    const payload = {
      description,
      documents: Array.from(selected),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    };

    setSubmitting(true);
    try {
      if (editing) await api.patch(`/meetings/${editing._id}`, payload);
      else await api.post('/meetings', payload);
      toast.success(editing ? 'แก้ไขคิวการแสดงผลเรียบร้อย' : 'เพิ่มคิวการแสดงผลเรียบร้อย');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
      <h3 className="font-bold text-gray-800">{editing ? 'แก้ไขคิวการแสดงผล' : 'เพิ่มคิวการแสดงผล'}</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          หัวข้อ/ข้อความประชุม <span className="text-xs font-normal text-gray-400">(ถ้าไม่ระบุ จะใช้ชื่อเอกสารแทน)</span>
        </label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2}
          maxLength={500} placeholder="เช่น: ประชุมคณะกรรมการบริหาร ครั้งที่ 1/2569" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เริ่มประชุม <span className="text-red-500">*</span></label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">สิ้นสุดประชุม <span className="text-red-500">*</span></label>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-blue-600">
        ระบบจะแสดงเอกสารล่วงหน้า 1 ชั่วโมงก่อนเริ่ม และค้างไว้อีก 1 ชั่วโมงหลังจบ (เว้นแต่มีคิวถัดไปต่อเนื่องทันที)
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เลือกเอกสารประชุม <span className="text-red-500">*</span>
        </label>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีเอกสารประชุม — กรุณาเพิ่มเอกสารในแท็บ &ldquo;จัดการเอกสารประชุม&rdquo; ก่อน</p>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {docs.map((d) => (
              <label key={d._id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.has(d._id)} onChange={() => toggleDoc(d._id)}
                  className="w-4 h-4 accent-primary" />
                <span className="flex-1 text-gray-700">{d.title}</span>
                <span className="text-xs text-gray-400">{d.attachments?.length || 0} ไฟล์</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={submitting}
          className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
          {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40">ยกเลิก</button>
      </div>
    </form>
  );
}
