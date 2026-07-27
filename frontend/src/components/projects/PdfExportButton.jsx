import { useState } from 'react';

/**
 * ปุ่ม Export PDF — lazy-load jsPDF + html2canvas เพื่อไม่เพิ่ม bundle size
 * @param {React.RefObject} contentRef - ref ไปยัง printable element
 * @param {string} filename - ชื่อไฟล์ PDF (ไม่รวม .pdf)
 * @param {string} [className] - CSS class เพิ่มเติม
 */
export default function PdfExportButton({ contentRef, filename = 'report', className = '' }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!contentRef?.current) return;
    setExporting(true);
    try {
      // Dynamic import — โหลดเฉพาะตอนกดปุ่ม (ลด initial bundle ~1MB)
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const element = contentRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let yPos = margin;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = (sliceHeight * canvas.width) / contentWidth;

        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(
          canvas,
          0, sourceY * (canvas.width / contentWidth),
          canvas.width, sliceCanvas.height,
          0, 0,
          canvas.width, sliceCanvas.height
        );

        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yPos, contentWidth, sliceHeight);
        remainingHeight -= sliceHeight;
        sourceY += sliceHeight;
        if (remainingHeight > 0) { pdf.addPage(); yPos = margin; }
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition ${className}`}
    >
      {exporting ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      {exporting ? 'กำลังสร้าง PDF...' : 'Export PDF'}
    </button>
  );
}
