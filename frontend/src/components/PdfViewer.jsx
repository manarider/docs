import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// ลดจาก 2.5 เดิม — เอกสารสแกนความละเอียดสูงจะ render หนักมากที่ scale สูง
// 1.5 เท่าของ devicePixelRatio ยังคมชัดพอสำหรับอ่านบนมือถือ แต่ลดเวลา render ต่อหน้าได้มาก
const MAX_RENDER_DPR = 1.5;
// ระยะล่วงหน้าก่อนหน้าจะเข้ามาในจอ ให้เริ่ม render ไว้ก่อนผู้ใช้เลื่อนมาถึง (เลื่อนลื่นไม่มีรอ)
const PRELOAD_ROOT_MARGIN = '600px 0px';

/**
 * เตรียม worker ของ pdf.js แบบ blob: URL (ครั้งเดียว ใช้ร่วมกันทุก instance)
 * เหตุผล: เซิร์ฟเวอร์/nginx บางเครื่องไม่รู้จัก MIME type ของไฟล์ .mjs (ส่งเป็น
 * application/octet-stream) ทำให้เบราว์เซอร์ปฏิเสธโหลด module worker ตรง ๆ
 * การ fetch เนื้อไฟล์มาสร้างเป็น Blob พร้อมกำหนด type เองจึงการันตี MIME ที่ถูกต้อง
 * โดยไม่ต้องพึ่งพาการตั้งค่าฝั่งเซิร์ฟเวอร์
 */
let workerSrcPromise = null;
function ensureWorkerSrc() {
  if (!workerSrcPromise) {
    workerSrcPromise = fetch(workerSrc)
      .then((res) => res.text())
      .then((code) => {
        const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;
        return blobUrl;
      })
      .catch(() => {
        // fallback: ใช้ URL ตรง ถ้า fetch ล้มเหลว (เช่น ออฟไลน์)
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        return workerSrc;
      });
  }
  return workerSrcPromise;
}

/**
 * แสดงผลไฟล์ PDF ด้วย pdf.js (render เป็น canvas ในเบราว์เซอร์)
 * แทนการฝัง <iframe>/<embed> ตรง ๆ เพราะเบราว์เซอร์มือถือหลายตัว
 * (โดยเฉพาะ Chrome บน Android) ไม่มีตัวแสดงผล PDF ในตัวสำหรับ iframe
 * ทำให้หน้าว่างเปล่า — pdf.js รับประกันผลลัพธ์ที่สม่ำเสมอทุกอุปกรณ์/เบราว์เซอร์
 *
 * Render แบบ lazy/virtualized: แสดงหน้าแรกทันทีที่พร้อม (ไม่ต้องรอทุกหน้า) แล้ว render
 * หน้าที่เหลือเมื่อเลื่อนใกล้ถึง (IntersectionObserver) — สำคัญมากสำหรับเอกสารสแกน
 * หลายสิบหน้าที่แต่ละหน้าเป็นภาพความละเอียดสูง ซึ่ง render ทุกหน้าล่วงหน้าจะช้ามาก
 */
export default function PdfViewer({ url, onError }) {
  const containerRef = useRef(null);
  const docCacheRef = useRef(null); // { url, pdfDoc } — กันโหลดไฟล์ซ้ำตอน resize
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null); // 0-100 หรือ null ถ้ายังไม่ทราบขนาดไฟล์
  const [resizeTick, setResizeTick] = useState(0);
  const lastWidthRef = useRef(typeof window !== 'undefined' ? window.innerWidth : 0);

  // debounce resize/rotate — รีเฟรช layout เมื่อหมุนจอ/ปรับขนาดหน้าต่างจริงเท่านั้น
  // (เทียบกับ window.innerWidth ไม่ใช่ขนาด container ภายใน เพื่อไม่ให้ scrollbar ที่โผล่ขึ้นมา
  // จากการ render หน้า PDF เอง ไปกระตุ้น resize event ซ้ำเป็นลูปไม่รู้จบ)
  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const newWidth = window.innerWidth;
        if (Math.abs(newWidth - lastWidthRef.current) < 20) return;
        lastWidthRef.current = newWidth;
        setResizeTick((t) => t + 1);
      }, 300);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ปิด/ทำลายเอกสารเดิมเมื่อเปลี่ยน url จริง ๆ หรือ unmount (ไม่ใช่ตอน resize)
  useEffect(() => {
    return () => {
      if (docCacheRef.current?.pdfDoc) {
        docCacheRef.current.pdfDoc.destroy();
        docCacheRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    let observer = null;
    setLoading(true);
    setProgress(null);

    async function setup() {
      try {
        await ensureWorkerSrc();
        if (cancelled) return;

        // ใช้เอกสารที่โหลดไว้แล้วถ้า url เดิม (เช่นตอน resize) — ไม่ต้องดาวน์โหลดซ้ำ
        let pdfDoc = docCacheRef.current?.url === url ? docCacheRef.current.pdfDoc : null;
        if (!pdfDoc) {
          // rangeChunkSize ใหญ่ขึ้น (1MB แทนค่า default 64KB) — ลดจำนวน HTTP request
          // ต่อการเปิดเอกสาร 1 ครั้งลงมาก ช่วยไม่ให้ชน rate limit ของเซิร์ฟเวอร์เร็วเกินไป
          // (สำคัญมากเมื่อผู้ร่วมประชุมหลายคนใช้ IP เดียวกัน)
          const loadingTask = pdfjsLib.getDocument({ url, rangeChunkSize: 1024 * 1024 });
          loadingTask.onProgress = ({ loaded, total }) => {
            if (cancelled) return;
            if (total) setProgress(Math.min(100, Math.round((loaded / total) * 100)));
          };
          pdfDoc = await loadingTask.promise;
          if (cancelled) {
            pdfDoc.destroy();
            return;
          }
          docCacheRef.current = { url, pdfDoc };
        }

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        const containerWidth = container.clientWidth || 360;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);

        // สร้าง placeholder ของทุกหน้าก่อน (จองพื้นที่ตามสัดส่วนจริง) เพื่อให้ scrollbar/
        // ความสูงถูกต้องตั้งแต่แรก ไม่มีหน้าจอกระโดดขณะ render หน้าถัด ๆ ไป
        const entries = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;

          const wrapper = document.createElement('div');
          wrapper.style.cssText =
            'position:relative;width:100%;margin-bottom:10px;background:#fff;' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.15);aspect-ratio:' +
            `${baseViewport.width}/${baseViewport.height};`;

          const canvas = document.createElement('canvas');
          canvas.style.cssText = 'width:100%;height:100%;display:block;';
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          entries.push({ page, wrapper, canvas, scale, rendered: false, rendering: false });
        }
        if (cancelled) return;

        const renderEntry = async (entry) => {
          if (entry.rendered || entry.rendering || cancelled) return;
          entry.rendering = true;
          try {
            const viewport = entry.page.getViewport({ scale: entry.scale * dpr });
            entry.canvas.width = Math.ceil(viewport.width);
            entry.canvas.height = Math.ceil(viewport.height);
            const ctx = entry.canvas.getContext('2d');
            await entry.page.render({ canvasContext: ctx, viewport }).promise;
            entry.rendered = true;
          } catch {
            // ไม่ throw ต่อ — ปล่อยให้หน้าอื่นยัง render ได้ตามปกติ
          } finally {
            entry.rendering = false;
          }
        };

        // Render หน้าแรกก่อน แล้วเปิดให้เห็นทันที (ไม่ต้องรอหน้าที่เหลือทั้งหมด)
        if (entries[0]) await renderEntry(entries[0]);
        if (cancelled) return;
        setLoading(false);
        // พรีโหลดหน้าถัดไปเงียบ ๆ เผื่อผู้ใช้เลื่อนทันที
        if (entries[1]) renderEntry(entries[1]);

        // รอให้ browser layout นิ่งก่อนค่อยเริ่ม observe — ป้องกันบั๊กที่ IntersectionObserver
        // รายงานว่า element ทุกตัว "intersecting" พร้อมกันในรอบแรก ถ้า observe ทันทีหลัง
        // เพิ่ง append DOM จำนวนมากในจังหวะเดียวกัน (layout ยังไม่ finalize)
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (cancelled) return;

        observer = new IntersectionObserver(
          (obsEntries) => {
            obsEntries.forEach((oe) => {
              if (!oe.isIntersecting) return;
              const found = entries.find((en) => en.wrapper === oe.target);
              if (found) renderEntry(found);
            });
          },
          { root: container, rootMargin: PRELOAD_ROOT_MARGIN }
        );
        entries.forEach((en) => observer.observe(en.wrapper));
      } catch (err) {
        if (!cancelled) {
          onError?.(err);
          setLoading(false);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, resizeTick]);

  return (
    <div
      className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-gray-200"
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 p-8">
          {progress !== null ? (
            <div className="w-full max-w-xs text-center">
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-500 text-sm">
                {progress < 100 ? `กำลังดาวน์โหลดเอกสาร... ${progress}%` : 'กำลังประมวลผลเอกสาร...'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-3 text-sm">กำลังโหลดเอกสาร...</p>
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className="px-2 py-3 min-h-full" />
    </div>
  );
}
