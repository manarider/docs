import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function PrintReportButton({ projectId, module, recordId, className = '' }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (showMenu && templates.length === 0) {
      loadTemplates();
    }
  }, [showMenu]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/projects/${projectId}/reports/${module}/${recordId}/templates`
      );
      setTemplates(data.data || []);
    } catch (err) {
      toast.error('โหลด template ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = (templateId) => {
    const url = `/docs/api/projects/${projectId}/reports/${module}/${recordId}/generate/${templateId}`;
    setPdfUrl(url);
    setShowMenu(false);
  };

  const handleDownload = (templateId, templateName) => {
    const url = `/docs/api/projects/${projectId}/reports/${module}/${recordId}/generate/${templateId}?download=1`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName || 'report'}.pdf`;
    a.click();
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={className || 'text-xs border border-primary text-primary rounded px-3 py-1 hover:bg-orange-50'}
        >
          🖨 พิมพ์รายงาน
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
              <div className="p-3 border-b">
                <p className="text-xs font-medium text-gray-700">เลือก Template</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-400">กำลังโหลด...</div>
                ) : templates.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    ไม่มี template ที่ใช้ได้
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <div
                      key={tpl._id}
                      className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 space-y-2"
                    >
                      <p className="text-sm font-medium text-gray-800">{tpl.name}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerate(tpl._id)}
                          className="flex-1 text-xs bg-primary text-white rounded px-2 py-1 hover:bg-orange-600"
                        >
                          ดู
                        </button>
                        <button
                          onClick={() => handleDownload(tpl._id, tpl.name)}
                          className="flex-1 text-xs border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50"
                        >
                          ดาวน์โหลด
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* PDF Preview Modal */}
      {pdfUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">ตัวอย่าง PDF</h3>
              <button
                onClick={() => setPdfUrl(null)}
                className="text-gray-400 hover:text-gray-600 p-1 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
