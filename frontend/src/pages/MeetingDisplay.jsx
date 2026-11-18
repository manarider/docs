import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';

// โหลด pdf.js แบบ lazy — ลดขนาด bundle หลักของทั้งระบบ เพราะใช้เฉพาะหน้านี้
const PdfViewer = lazy(() => import('../components/PdfViewer'));

const POLL_INTERVAL_MS = 10000;
const WARNING_MS = 15 * 60 * 1000;

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * หน้าแสดงผลระบบจัดการเอกสารประชุม (MeetingDocs) — สาธารณะ ไม่ต้อง login
 * URL: /docs/meet — ออกแบบสำหรับมือถือ/แท็บเล็ตเป็นหลัก รองรับทุกขนาดหน้าจอ
 */
export default function MeetingDisplay() {
  const [data, setData] = useState(null); // payload ปัจจุบันจาก /meetings/public/current หรือ null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [screen, setScreen] = useState('list'); // 'list' | 'viewer'
  const [activeButton, setActiveButton] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const meetingIdRef = useRef(null);

  const fetchCurrent = useCallback(() => {
    fetch('/docs/api/meetings/public/current')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCurrent();
    const interval = setInterval(fetchCurrent, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCurrent]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // เมื่อคิวการประชุมเปลี่ยน (หมดเวลา/เปลี่ยนเป็นคิวถัดไป) ให้กลับไปหน้าเลือกเอกสารเสมอ
  useEffect(() => {
    const currentId = data?.meeting_id || null;
    if (currentId !== meetingIdRef.current) {
      meetingIdRef.current = currentId;
      setScreen('list');
      setActiveButton(null);
      setPdfUrl(null);
    }
  }, [data?.meeting_id]);

  const [downloading, setDownloading] = useState(false);

  const openButton = (btn) => {
    setActiveButton(btn);
    setScreen('viewer');
    setPdfError(false);
    if (btn.kind === 'pdf') {
      setPdfUrl(`/docs/api/meetings/public/file/${data.meeting_id}/${btn.doc_id}/${btn.sub_id}`);
    } else {
      setPdfUrl(null);
    }
  };

  const goBack = () => {
    setScreen('list');
    setActiveButton(null);
    setPdfUrl(null);
  };

  const handleDownload = async () => {
    if (!pdfUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
      const filename = match ? decodeURIComponent(match[1]) : `${activeButton?.label || 'document'}.pdf`;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDownloading(false);
    }
  };

  const msLeft = data?.display_until ? new Date(data.display_until).getTime() - now : null;
  const showWarning = msLeft !== null && msLeft > 0 && msLeft <= WARNING_MS;

  // ─── หน้าแสดงเอกสารเต็มจอ (PDF / Google Docs-Sheets) ───────────────────────
  if (screen === 'viewer' && activeButton) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-900">
        {/* แถบด้านบน — ย้อนกลับไปเลือกเอกสารอื่น */}
        <div className="flex items-center gap-2 bg-primary text-white px-3 py-2 shrink-0 shadow-md z-10" style={{ minHeight: 44 }}>
          <button
            onClick={goBack}
            className="flex items-center gap-1 bg-white/15 hover:bg-white/25 active:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-medium transition shrink-0"
            style={{ minHeight: 40 }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            ย้อนกลับ
          </button>
          <p className="text-sm font-medium truncate flex-1">{activeButton.label}</p>
          {activeButton.kind === 'pdf' && pdfUrl && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center bg-white/15 hover:bg-white/25 active:bg-white/30 rounded-lg transition shrink-0 disabled:opacity-60"
              style={{ width: 40, height: 40 }}
              title="ดาวน์โหลดเอกสาร"
              aria-label="ดาวน์โหลดเอกสาร"
            >
              {downloading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* เนื้อหาเอกสาร — เต็มพื้นที่ที่เหลือ
            min-h-0 จำเป็น: ไม่เช่นนั้น flex item นี้จะขยายสูงตามเนื้อหา PDF ที่ยาวกว่าจอ
            (min-height: auto เป็นค่า default ของ flex item) ทำให้ scroll ภายใน PdfViewer ใช้ไม่ได้ */}
        <div className="flex-1 min-h-0 relative bg-gray-100">
          {activeButton.kind === 'google' ? (
            <iframe
              src={activeButton.url}
              title={activeButton.label}
              className="absolute inset-0 w-full h-full border-0"
              allow="fullscreen"
            />
          ) : pdfError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-gray-500 text-sm text-center">ไม่สามารถเปิดเอกสารนี้ได้ อาจหมดเวลาแสดงผลแล้ว</p>
            </div>
          ) : pdfUrl ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <PdfViewer url={pdfUrl} onError={() => setPdfError(true)} />
            </Suspense>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── หน้าเลือกเอกสาร (รายการปุ่ม) ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-primary rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-800">เอกสารการประชุม</h1>
          <p className="text-xs text-gray-400">ระบบจัดการเอกสารประชุม (MeetingDocs)</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-3 text-sm">กำลังโหลด...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center space-y-2">
            <p className="text-gray-500 text-sm">ไม่สามารถเชื่อมต่อระบบได้ กำลังลองใหม่...</p>
          </div>
        ) : !data ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center space-y-2">
            <div className="text-4xl mb-1">🕐</div>
            <p className="text-gray-600 font-medium">ยังไม่มีเอกสารประชุมในขณะนี้</p>
            <p className="text-xs text-gray-400">หน้านี้จะอัปเดตอัตโนมัติเมื่อถึงเวลาประชุม</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
              <p className="text-base font-semibold text-gray-800 leading-snug">{data.message}</p>
              <p className="text-xs text-gray-400">
                {new Date(data.starts_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
                {' — '}
                {new Date(data.ends_at).toLocaleTimeString('th-TH', { timeStyle: 'short' })}
              </p>

              {showWarning && (
                <div className="bg-amber-50 border border-amber-300 text-amber-700 rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2">
                  ⚠️ เอกสารนี้จะหมดเวลาแสดงผลในอีก {formatCountdown(msLeft)} นาที
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {data.buttons.length === 0 ? (
                <div className="bg-white rounded-2xl shadow p-6 text-center text-sm text-gray-400">
                  ไม่มีไฟล์เอกสารที่พร้อมแสดงผลในขณะนี้
                </div>
              ) : (
                data.buttons.map((btn, idx) => (
                  <button
                    key={`${btn.doc_id}-${btn.sub_id}-${idx}`}
                    onClick={() => openButton(btn)}
                    className="w-full bg-white hover:bg-orange-50 active:bg-orange-100 border border-orange-200 rounded-2xl shadow px-4 py-3.5 flex items-center gap-3 transition text-left"
                    style={{ minHeight: 56 }}
                  >
                    <span className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg shrink-0">
                      {btn.kind === 'google' ? '🔗' : '📄'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-800 truncate">{btn.label}</span>
                      <span className="block text-xs text-gray-400">
                        {btn.kind === 'google' ? 'Google Docs/Sheets' : 'เอกสาร PDF'}
                      </span>
                    </span>
                    <svg className="w-5 h-5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-300 pt-4">ระบบบริหารจัดการเอกสาร · เทศบาลนครนครสวรรค์</p>
      </div>
    </div>
  );
}
