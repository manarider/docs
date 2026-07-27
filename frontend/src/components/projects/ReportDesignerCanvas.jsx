import { useState, useEffect, useRef } from 'react';

/**
 * Component สำหรับแสดง Canvas ในหน้า Report Designer
 * - แสดง Background ที่เป็น PNG/JPG ได้โดยตรง
 * - ใช้ PDF.js เพื่อแปลง Background ที่เป็น PDF ให้เป็นรูปภาพก่อนแสดงผล
 *   เพื่อแก้ปัญหาไม่สามารถลาก-วาง field ทับ &lt;iframe&gt; หรือ &lt;embed&gt; ได้
 *
 * อ้างอิง: CreateReport.md หัวข้อ 9 และ 19
 *
 * @param {{
 *   backgroundUrl: string | null;
 *   backgroundFileName: string | null;
 *   paperSize: 'A4' | 'A5' | 'Letter' | 'Legal';
 *   orientation: 'portrait' | 'landscape';
 * }} props
 */
export default function ReportDesignerCanvas({ backgroundUrl, backgroundFileName, paperSize = 'A4', orientation = 'portrait' }) {
    const [bgImage, setBgImage] = useState(null);
    const [renderingPdf, setRenderingPdf] = useState(false);
    const [error, setError] = useState(null);
    const canvasContainerRef = useRef(null);

    // ค่าคงที่ขนาดกระดาษ (points)
    const PAPER_SIZES = {
        A4: { portrait: [595.28, 841.89], landscape: [841.89, 595.28] },
        A5: { portrait: [419.53, 595.28], landscape: [595.28, 419.53] },
        Letter: { portrait: [612, 792], landscape: [792, 612] },
        Legal: { portrait: [612, 1008], landscape: [1008, 612] },
    };

    const [width, height] = PAPER_SIZES[paperSize][orientation];

    useEffect(() => {
        let isMounted = true;
        // Cleanup blob URL เมื่อ component unmount
        const oldBgImage = bgImage;

        const loadAndRenderPdf = async (url) => {
            console.log('[ReportDesignerCanvas] Loading PDF:', url);
            setRenderingPdf(true);
            setError(null);
            try {
                // 1. โหลด PDF.js script ถ้ายังไม่มี
                if (!window.pdfjsLib) {
                    console.log('[ReportDesignerCanvas] Loading PDF.js library...');
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                        script.async = true;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }

                // 2. โหลด PDF และ render หน้าแรกเป็น canvas
                const loadingTask = window.pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                if (!isMounted) return;

                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 เพื่อความคมชัด

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');

                await page.render({ canvasContext: context, viewport }).promise;
                if (!isMounted) return;

                // 3. แปลง canvas เป็น Blob URL (ดีกว่า Data URL สำหรับ performance)
                canvas.toBlob((blob) => {
                    if (isMounted) {
                        const blobUrl = URL.createObjectURL(blob);
                        setBgImage(blobUrl);
                    }
                }, 'image/png');

            } catch (err) {
                console.error('Error rendering PDF background:', err);
                if (isMounted) setError('ไม่สามารถแสดงผลไฟล์ PDF ได้');
            } finally {
                if (isMounted) setRenderingPdf(false);
            }
        };

        console.log('[ReportDesignerCanvas] backgroundUrl:', backgroundUrl);
        console.log('[ReportDesignerCanvas] backgroundFileName:', backgroundFileName);

        if (backgroundUrl) {
            // ใช้ backgroundFileName เพื่อตรวจสอบประเภทไฟล์ แทนการใช้ URL
            const isPdf = backgroundFileName && backgroundFileName.toLowerCase().endsWith('.pdf');

            if (isPdf) {
                console.log('[ReportDesignerCanvas] Detected PDF, will render to canvas');
                loadAndRenderPdf(backgroundUrl);
            } else {
                // สำหรับ PNG/JPG, ใช้ URL โดยตรง
                console.log('[ReportDesignerCanvas] Detected image, using direct URL');
                setBgImage(backgroundUrl);
            }
        } else {
            console.log('[ReportDesignerCanvas] No background URL provided');
            setBgImage(null);
        }

        return () => {
            isMounted = false;
            if (oldBgImage && oldBgImage.startsWith('blob:')) {
                URL.revokeObjectURL(oldBgImage);
            }
        };
    }, [backgroundUrl, backgroundFileName]);

    return (
        <div
            ref={canvasContainerRef}
            className="relative bg-white shadow-lg w-full h-full overflow-hidden"
        >
            {/* พื้นหลัง (แสดงเป็น <img> เพื่อให้ลาก field ทับได้) */}
            {bgImage && (
                <img
                    src={bgImage}
                    alt="Report Background"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    onLoad={() => console.log('[ReportDesignerCanvas] Image loaded successfully')}
                    onError={(e) => {
                        console.error('[ReportDesignerCanvas] Image failed to load:', e);
                        setError('ไม่สามารถโหลดรูปภาพได้');
                    }}
                />
            )}

            {/* No background placeholder */}
            {!bgImage && !renderingPdf && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
                    <div className="text-center text-gray-400">
                        <p className="text-sm">ไม่มีพื้นหลัง</p>
                        <p className="text-xs mt-1">อัปโหลดไฟล์ PDF, PNG หรือ JPG</p>
                    </div>
                </div>
            )}

            {/* Loading/Error State */}
            {renderingPdf && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">กำลังโหลด PDF background...</p>
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {/* Placeholder for draggable fields */}
            <div className="absolute inset-0">
                {/* TODO: Render draggable fields here */}
            </div>
        </div>
    );
}