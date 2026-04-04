import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Tab: เอกสารที่ถูกลบ ──────────────────────────────────────────────────────
function DocumentTrash() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 20;

  const load = (p = 1) => {
    setLoading(true);
    api.get(`/documents/trash?page=${p}&limit=${limit}`)
      .then(({ data }) => { setDocs(data.data || []); setTotal(data.pagination?.total || 0); })
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.ceil(total / limit);

  const handleAction = async () => {
    if (!confirmDoc) return;
    setActionLoading(true);
    try {
      if (confirmDoc.action === 'restore') {
        await api.post(`/documents/${confirmDoc.doc._id}/restore`);
        toast.success('คืนเอกสารเรียบร้อย');
      } else {
        await api.delete(`/documents/${confirmDoc.doc._id}/permanent`);
        toast.success('ลบถาวรเรียบร้อย');
      }
      setConfirmDoc(null);
      load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-medium">ไม่มีเอกสารที่ถูกลบ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc._id} className="bg-white rounded-xl shadow-sm border border-red-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{doc.title}</p>
                  {doc.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{doc.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                    {doc.dept_id && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
                        🏢 {doc.dept_id.name}
                      </span>
                    )}
                    {doc.type_id && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                        🗂️ {doc.type_id.name}
                      </span>
                    )}
                    <span>ปีงบ {doc.fiscal_year}</span>
                    <span>{doc.attachments?.length || 0} ไฟล์
                      {doc.attachments?.length > 0 && (
                        <span className="ml-1 text-gray-300">
                          ({doc.attachments.reduce((s, a) => s + (a.file_size || 0), 0) > 0
                            ? formatSize(doc.attachments.reduce((s, a) => s + (a.file_size || 0), 0))
                            : ''})
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-red-400 mt-1.5">
                    🗑️ ลบเมื่อ {formatDate(doc.deleted_at)}
                  </p>
                  {doc.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {doc.attachments.map((a, i) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded">
                          📎 {a.sub_title} {a.file_size ? `(${formatSize(a.file_size)})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmDoc({ doc, action: 'restore' })}
                    className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600 transition"
                  >↩ ส่งคืน</button>
                  <button
                    onClick={() => setConfirmDoc({ doc, action: 'permanent' })}
                    className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition"
                  >🗑 ลบถาวร</button>
                </div>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-2">
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

      {confirmDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            {confirmDoc.action === 'restore' ? (
              <>
                <h3 className="font-bold text-gray-800 text-lg">ยืนยันการส่งคืนเอกสาร</h3>
                <p className="text-sm text-gray-600">
                  คืนเอกสาร "<strong>{confirmDoc.doc.title}</strong>" กลับมาในระบบ?
                </p>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setConfirmDoc(null)}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleAction} disabled={actionLoading}
                    className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-60">
                    {actionLoading ? 'กำลังดำเนินการ...' : '↩ ส่งคืน'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-red-700 text-lg">⚠️ ลบเอกสารถาวร</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <p className="font-medium">การกระทำนี้ไม่สามารถย้อนกลับได้!</p>
                  <p className="mt-1">เอกสาร "<strong>{confirmDoc.doc.title}</strong>" และไฟล์แนบทั้งหมด
                    ({confirmDoc.doc.attachments?.length || 0} ไฟล์) จะถูกลบออกจากระบบและดิสก์อย่างถาวร</p>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setConfirmDoc(null)}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleAction} disabled={actionLoading}
                    className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                    {actionLoading ? 'กำลังลบ...' : '🗑 ลบถาวร'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: ไฟล์แนบที่ถูกลบ ──────────────────────────────────────────────────────
function AttachmentTrash() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAtt, setConfirmAtt] = useState(null); // { item, action: 'restore'|'permanent' }
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/documents/trash/attachments')
      .then(({ data }) => setItems(data.data || []))
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!confirmAtt) return;
    setActionLoading(true);
    try {
      const { item, action } = confirmAtt;
      if (action === 'restore') {
        await api.post(`/documents/${item.docId}/attachments/${item.subId}/restore`);
        toast.success('คืนไฟล์แนบเรียบร้อย');
      } else {
        await api.delete(`/documents/${item.docId}/attachments/${item.subId}/permanent`);
        toast.success('ลบไฟล์แนบถาวรเรียบร้อย');
      }
      setConfirmAtt(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-medium">ไม่มีไฟล์แนบที่ถูกลบ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-orange-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">📎 {item.subTitle}</span>
                    {item.originalName && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]" title={item.originalName}>
                        ({item.originalName})
                      </span>
                    )}
                    {item.fileSize > 0 && (
                      <span className="text-xs text-gray-400">{formatSize(item.fileSize)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    เอกสาร: <span className="font-medium text-gray-700">{item.docTitle}</span>
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                    {item.dept && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
                        🏢 {item.dept.name}
                      </span>
                    )}
                    {item.type && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                        🗂️ {item.type.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-400 mt-1.5">
                    🗑️ ลบเมื่อ {formatDate(item.deletedAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmAtt({ item, action: 'restore' })}
                    className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600 transition"
                  >↩ ส่งคืน</button>
                  <button
                    onClick={() => setConfirmAtt({ item, action: 'permanent' })}
                    className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition"
                  >🗑 ลบถาวร</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmAtt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            {confirmAtt.action === 'restore' ? (
              <>
                <h3 className="font-bold text-gray-800 text-lg">ยืนยันการส่งคืนไฟล์แนบ</h3>
                <p className="text-sm text-gray-600">
                  คืนไฟล์แนบ "<strong>{confirmAtt.item.subTitle}</strong>"
                  กลับไปยังเอกสาร "<strong>{confirmAtt.item.docTitle}</strong>"?
                </p>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setConfirmAtt(null)}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleAction} disabled={actionLoading}
                    className="bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-60">
                    {actionLoading ? 'กำลังดำเนินการ...' : '↩ ส่งคืน'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-red-700 text-lg">⚠️ ลบไฟล์แนบถาวร</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <p className="font-medium">การกระทำนี้ไม่สามารถย้อนกลับได้!</p>
                  <p className="mt-1">
                    ไฟล์ "<strong>{confirmAtt.item.subTitle}</strong>" จะถูกลบออกจากระบบและดิสก์อย่างถาวร
                  </p>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setConfirmAtt(null)}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleAction} disabled={actionLoading}
                    className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                    {actionLoading ? 'กำลังลบ...' : '🗑 ลบถาวร'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminTrash() {
  const [tab, setTab] = useState('docs'); // 'docs' | 'attachments'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">จัดการรายการที่ถูกลบ</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('docs')}
          className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'docs'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🗂️ เอกสาร
        </button>
        <button
          onClick={() => setTab('attachments')}
          className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'attachments'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📎 ไฟล์แนบ
        </button>
      </div>

      {tab === 'docs' ? <DocumentTrash /> : <AttachmentTrash />}
    </div>
  );
}
