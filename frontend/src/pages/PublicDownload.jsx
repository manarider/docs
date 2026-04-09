import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function PublicDownload() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    fetch(`/docs/api/share/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setInfo(j.data);
        else setError(j.message || 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว');
      })
      .catch(() => setError('ไม่สามารถเชื่อมต่อระบบได้'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (subId, name) => {
    setDownloading(subId);
    try {
      const res = await fetch(`/docs/api/share/${token}/file/${subId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message || 'ดาวน์โหลดไม่สำเร็จ');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('ดาวน์โหลดไม่สำเร็จ');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-gray-800">ไม่สามารถเข้าถึงได้</h1>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-xs text-gray-400">ลิงก์นี้อาจหมดอายุหรือถูกเพิกถอนแล้ว<br />กรุณาติดต่อผู้ที่ส่งลิงก์นี้ให้คุณ</p>
        </div>
      </div>
    );
  }

  const expiresAt = info?.expires_at ? new Date(info.expires_at) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">เอกสารสำหรับดาวน์โหลด</p>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">{info.title}</h1>
            </div>
          </div>

          {info.description && (
            <p className="text-sm text-gray-600 mb-3">{info.description}</p>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
            {info.dept && <span>หน่วยงาน: <span className="text-gray-700 font-medium">{info.dept}</span></span>}
            {info.fiscal_year && <span>ปีงบฯ: <span className="text-gray-700 font-medium">{info.fiscal_year}</span></span>}
          </div>

          {expiresAt && (
            <p className="mt-3 text-xs text-orange-600 border border-orange-200 bg-orange-50 rounded-lg px-3 py-1.5">
              ⏰ ลิงก์นี้ใช้งานได้ถึง: {expiresAt.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          )}
        </div>

        {/* Attachment list */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-3">
            ไฟล์ที่ดาวน์โหลดได้ ({info.attachments?.length || 0})
          </h2>
          {!info.attachments?.length ? (
            <p className="text-sm text-gray-400">ไม่มีไฟล์แนบ</p>
          ) : (
            <div className="space-y-2">
              {info.attachments.map((att) => (
                <div key={att.sub_id}
                  className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{att.sub_title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {att.original_name} — {(att.file_size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(att.sub_id, att.original_name)}
                    disabled={downloading === att.sub_id}
                    className="shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-60"
                  >
                    {downloading === att.sub_id ? (
                      <span className="animate-pulse">กำลังดาวน์โหลด...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        ดาวน์โหลด
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          ระบบบริหารจัดการเอกสาร · เทศบาลนครนครสวรรค์
        </p>
      </div>
    </div>
  );
}
