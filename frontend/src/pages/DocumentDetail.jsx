import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingAtt, setViewingAtt] = useState(null); // { sub_id, sub_title, blobUrl }
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareInfo, setShareInfo] = useState(null); // DOW share info

  useEffect(() => {
    api.get(`/documents/${id}`)
      .then(({ data }) => {
        const d = data.data;
        setDoc(d);
        if (d.type_id?.code?.toUpperCase() === 'DOW') {
          return api.get(`/documents/${id}/share`)
            .then(({ data: sd }) => setShareInfo(sd.data))
            .catch(() => {});
        }
      })
      .catch(() => toast.error('โหลดเอกสารไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadQrCode = () => {
    if (!shareInfo?.qr_code) return;
    const a = document.createElement('a');
    a.href = shareInfo.qr_code;
    a.download = 'qrcode-download.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownload = async (subId, name) => {
    try {
      const res = await api.get(`/documents/${id}/attachments/${subId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('ดาวน์โหลดไม่สำเร็จ');
    }
  };

  const handleView = async (att) => {
    if (viewingAtt?.sub_id === att.sub_id) {
      // toggle ปิด
      window.URL.revokeObjectURL(viewingAtt.blobUrl);
      setViewingAtt(null);
      return;
    }
    // ปิดตัวเก่า
    if (viewingAtt) {
      window.URL.revokeObjectURL(viewingAtt.blobUrl);
      setViewingAtt(null);
    }
    setViewLoading(true);
    try {
      const res = await api.get(`/documents/${id}/attachments/${att.sub_id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      setViewingAtt({ sub_id: att.sub_id, sub_title: att.sub_title, blobUrl });
    } catch {
      toast.error('เปิดไฟล์ไม่สำเร็จ');
    } finally {
      setViewLoading(false);
    }
  };

  const handlePrint = () => {
    if (!viewingAtt) return;
    const iframe = document.getElementById('pdf-viewer-frame');
    if (iframe) iframe.contentWindow.print();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/documents/${id}`);
      toast.success('ลบเอกสารเรียบร้อย');
      navigate('/documents');
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;
  if (!doc) return <div className="text-center py-20 text-gray-400">ไม่พบเอกสาร</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link to="/documents" className="text-sm text-primary hover:underline">← กลับรายการ</Link>
        <div className="flex gap-2">
          <Link
            to={`/documents/${id}/edit`}
            className="border border-primary text-primary px-4 py-1.5 rounded-lg text-sm hover:bg-orange-50 transition"
          >แก้ไข</Link>
          {isAdmin && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="border border-red-500 text-red-500 px-4 py-1.5 rounded-lg text-sm hover:bg-red-50 transition"
            >ลบ</button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{doc.title}</h2>
            {doc.description && <p className="text-gray-500 text-sm mt-1">{doc.description}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {doc.tags?.map((tag) => (
                <span key={tag} className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 shrink-0">
            <p>ปีงบ {doc.fiscal_year}</p>
            <p className="text-xs mt-1">{new Date(doc.createdAt).toLocaleDateString('th-TH')}</p>
            <p className="text-xs">{doc.views} ยอดวิว</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">หน่วยงาน: </span>
            <span className="font-medium">{doc.dept_id?.name || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">ประเภท: </span>
            <span className="font-medium">{doc.type_id?.name || '-'}</span>
          </div>
        </div>
      </div>

      {/* DOW Share Info Panel */}
      {doc.type_id?.code?.toUpperCase() === 'DOW' && shareInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <p className="font-semibold text-blue-800 text-sm">📤 ลิงก์แชร์ดาวน์โหลด</p>
          <div className="text-xs text-blue-700 space-y-0.5">
            <p>เริ่ม: {new Date(shareInfo.starts_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p>สิ้นสุด: {new Date(shareInfo.expires_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareInfo.share_url}
              className="flex-1 text-xs bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-gray-600 truncate"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(shareInfo.share_url); toast.success('คัดลอกลิงก์แล้ว'); }}
              className="text-xs border border-blue-300 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100 whitespace-nowrap"
            >คัดลอก</button>
          </div>
          {shareInfo.qr_code && (
            <div className="flex items-start gap-4">
              <img src={shareInfo.qr_code} alt="QR Code" className="w-28 h-28 border border-blue-200 rounded-lg bg-white p-1" />
              <div className="space-y-2 pt-1">
                <p className="text-xs text-blue-700">สแกน QR Code เพื่อดาวน์โหลด</p>
                <button
                  onClick={downloadQrCode}
                  className="flex items-center gap-1 text-xs bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ดาวน์โหลด QR
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {doc.attachments?.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-700 mb-3">ไฟล์แนบ ({doc.attachments.length})</h3>
          <div className="space-y-2">
            {doc.attachments.map((att) => {
              const isOpen = viewingAtt?.sub_id === att.sub_id;
              return (
                <div key={att.sub_id} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{att.sub_title}</p>
                      <p className="text-xs text-gray-400">
                        {att.original_name} — {(att.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleView(att)}
                        disabled={viewLoading}
                        className="text-primary text-sm font-medium hover:underline disabled:opacity-50"
                      >
                        {isOpen ? 'ซ่อน' : (viewLoading ? 'กำลังโหลด...' : 'ดูเอกสาร')}
                      </button>
                      <button
                        onClick={() => handleDownload(att.sub_id, att.original_name)}
                        className="text-gray-500 text-sm hover:underline"
                      >ดาวน์โหลด</button>
                    </div>
                  </div>

                  {/* Inline PDF Viewer */}
                  {isOpen && viewingAtt?.blobUrl && (
                    <div className="border-t border-gray-100">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                        <span className="text-xs text-gray-500">{viewingAtt.sub_title}</span>
                        <button
                          onClick={handlePrint}
                          className="flex items-center gap-1 text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-white transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm2-10V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                          </svg>
                          พิมพ์
                        </button>
                      </div>
                      <iframe
                        id="pdf-viewer-frame"
                        src={viewingAtt.blobUrl}
                        className="w-full"
                        style={{ height: '75vh' }}
                        title={viewingAtt.sub_title}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Images */}
      {doc.images?.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-gray-700 mb-3">รูปภาพ ({doc.images.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {doc.images.map((img, idx) => (
              <img
                key={idx}
                src={`/api/documents/${id}/images/${idx}`}
                alt={img.original_name}
                className="rounded-lg border border-gray-200 w-full object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">ยืนยันการลบเอกสาร</h3>
            <p className="text-sm text-gray-600">
              คุณต้องการลบ <span className="font-medium">"{doc.title}"</span> ใช่หรือไม่?
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >ยกเลิก</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >{deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
