import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ReportDesignerCanvas from '../components/projects/ReportDesignerCanvas';
import MobileWarning from '../components/MobileWarning';

const PAPER_SIZES = {
  A4: { portrait: [595, 842], landscape: [842, 595] },
  A5: { portrait: [420, 595], landscape: [595, 420] },
  Letter: { portrait: [612, 792], landscape: [792, 612] },
  Legal: { portrait: [612, 1008], landscape: [1008, 612] },
};

const PROJECT_FIELDS = [
  { id: '_project.title', label: 'ชื่อโครงการ' },
  { id: '_project.department', label: 'หน่วยงาน' },
  { id: '_project.fiscalYear', label: 'ปีงบประมาณ' },
  { id: '_project.location', label: 'สถานที่ดำเนินการ' },
  { id: '_project.district', label: 'อำเภอ' },
  { id: '_project.province', label: 'จังหวัด' },
  { id: '_project.phone', label: 'เบอร์โทรศัพท์' },
  { id: '_project.workVolume', label: 'ปริมาณงาน' },
  { id: '_project.quantity', label: 'จำนวน' },
  { id: '_project.contractNo', label: 'สัญญาเลขที่' },
  { id: '_project.contractDate', label: 'สัญญาลงวันที่' },
  { id: '_project.contractMonth', label: 'สัญญาเดือน' },
  { id: '_project.contractYear', label: 'สัญญา พ.ศ.' },
  { id: '_project.startDate', label: 'วันเริ่มสัญญา' },
  { id: '_project.endDate', label: 'วันสิ้นสุดสัญญา' },
  { id: '_project.budget', label: 'วงเงินโครงการ' },
  { id: '_project.contractor', label: 'ผู้รับจ้าง' },
  { id: '_project.duration', label: 'ระยะเวลาดำเนินการ' },
  { id: '_project.supervisor', label: 'ผู้ควบคุมงาน' },
  { id: '_project.committeeChairman', label: 'ประธานกรรมการ' },
  { id: '_project.committeeMember1', label: 'กรรมการ 1' },
  { id: '_project.committeeMember2', label: 'กรรมการ 2' },
];

const FIELD_CATALOG = {
  daily_report: [
    ...PROJECT_FIELDS,
    { id: 'report.reportDate', label: 'วันที่รายงาน' },
    { id: 'report.position', label: 'สถานที่' },
    { id: 'report.weather', label: 'สภาพภูมิอากาศ' },
    { id: 'report.obstacles', label: 'ปัญหา/อุปสรรค' },
    { id: 'report.otherInstructions', label: 'คำสั่งการ/แก้ไข' },
    { id: 'report.engineerCount', label: 'จำนวนวิศวกร/ช่าง' },
    { id: 'report.foremanCount', label: 'จำนวนหัวหน้าคนงาน' },
    { id: 'report.laborerCount', label: 'จำนวนกรรมกร' },
    { id: 'report.morningDescription', label: 'รายละเอียดภาคเช้า' },
    { id: 'report.afternoonDescription', label: 'รายละเอียดภาคบ่าย' },
    { id: 'report.workDescription', label: 'รายละเอียดงาน' },
    { id: 'report.submittedRole', label: 'ผู้บันทึก' },
    { id: 'report.photoCount', label: 'จำนวนภาพถ่าย' },
    { id: 'report.equipmentCount', label: 'จำนวนครุภัณฑ์' },
  ],
  procurement: [
    ...PROJECT_FIELDS,
    { id: 'procurement.receiveDate', label: 'วันที่รับ' },
    { id: 'procurement.itemType', label: 'ประเภท' },
    { id: 'procurement.description', label: 'รายละเอียด' },
    { id: 'procurement.quantity', label: 'จำนวนทั้งหมด' },
    { id: 'procurement.issuedQuantity', label: 'เบิกจ่ายแล้ว' },
    { id: 'procurement.remainingQuantity', label: 'คงเหลือ' },
    { id: 'procurement.serialCount', label: 'จำนวนครุภัณฑ์' },
  ],
  acceptance: [
    ...PROJECT_FIELDS,
    { id: 'acceptance.createdAt', label: 'วันที่ตรวจรับ' },
    { id: 'acceptance.notes', label: 'หมายเหตุ' },
    { id: 'acceptance.acceptedRole', label: 'ผู้ตรวจรับ' },
    { id: 'acceptance.deliveryDocTitle', label: 'เอกสารส่งมอบ' },
    { id: 'acceptance.photoCount', label: 'จำนวนภาพถ่าย' },
  ],
};

const IMAGE_FIELD_CATALOG = {
  daily_report: [
    { id: 'report.photos', label: 'ภาพถ่ายการปฏิบัติงาน (แกลเลอรี)' },
    { id: 'report.equipmentPhotos', label: 'ภาพถ่ายครุภัณฑ์ (แกลเลอรี)' },
  ],
  procurement: [
    { id: 'procurement.receivePhotos', label: 'ภาพถ่ายตอนรับพัสดุ (แกลเลอรี)' },
    { id: 'procurement.inspectionPhotos', label: 'ภาพถ่ายตรวจสอบ (แกลเลอรี)' },
  ],
  acceptance: [
    { id: 'acceptance.inspectionPhotos', label: 'ภาพถ่ายตรวจรับงาน (แกลเลอรี)' },
  ],
};

const GRID_LAYOUT_PRESETS = ['1x1', '1x2', '2x1', '2x2', '2x3', '3x2', '3x3'];

export default function TemplateDesigner() {
  const { projectId, templateId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const dragStartRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState({ width: 595, height: 842, scale: 1 });

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [bgFile, setBgFile] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/report-templates/${templateId}`);
      setTemplate(data.data);
    } catch (err) {
      toast.error('โหลด template ไม่สำเร็จ');
      navigate(`/projects/${projectId}/report-manager`);
    } finally {
      setLoading(false);
    }
  };

  const currentPage = template?.pages?.[currentPageIndex];
  const fields = FIELD_CATALOG[template?.module] || [];
  const imageFields = IMAGE_FIELD_CATALOG[template?.module] || [];
  const allFieldDefs = [...fields, ...imageFields];

  const canvasWidth = template ? PAPER_SIZES[currentPage?.paperSize || 'A4'][currentPage?.orientation || 'portrait'][0] : 595;
  const canvasHeight = template ? PAPER_SIZES[currentPage?.paperSize || 'A4'][currentPage?.orientation || 'portrait'][1] : 842;

  const handleAddField = (fieldId) => {
    if (!template || !currentPage) return;

    const currentFields = currentPage.fields || [];
    const newField = {
      fieldId,
      x: 50,
      y: 50 + currentFields.length * 25,
      width: 200,
      height: 20,
      fontSize: 16,
      fontFamily: 'THSarabunNew',
      color: '#000000',
      textAlign: 'left',
    };

    const updatedPages = template.pages.map((page, idx) => {
      if (idx !== currentPageIndex) return page;
      return {
        ...page,
        fields: [...(page.fields || []), newField],
      };
    });

    setTemplate({ ...template, pages: updatedPages });
    setSelectedFieldIndex(currentFields.length);
  };

  const handleAddImageField = (fieldId) => {
    if (!template || !currentPage) return;

    const currentFields = currentPage.fields || [];
    const newField = {
      fieldId,
      type: 'image',
      x: 50,
      y: 50 + currentFields.length * 25,
      width: 240,
      height: 180,
      gridRows: 1,
      gridCols: 1,
      gap: 4,
    };

    const updatedPages = template.pages.map((page, idx) => {
      if (idx !== currentPageIndex) return page;
      return {
        ...page,
        fields: [...(page.fields || []), newField],
      };
    });

    setTemplate({ ...template, pages: updatedPages });
    setSelectedFieldIndex(currentFields.length);
  };

  const handleFieldChange = (index, key, value) => {
    const updatedPages = template.pages.map((page, idx) => {
      if (idx !== currentPageIndex) return page;
      const updatedFields = page.fields.map((f, fIdx) => {
        if (fIdx !== index) return f;
        return { ...f, [key]: value };
      });
      return { ...page, fields: updatedFields };
    });
    setTemplate({ ...template, pages: updatedPages });
  };

  const handleDeleteField = (index) => {
    const updatedPages = template.pages.map((page, idx) => {
      if (idx !== currentPageIndex) return page;
      const updatedFields = page.fields.filter((_, fIdx) => fIdx !== index);
      return { ...page, fields: updatedFields };
    });
    setTemplate({ ...template, pages: updatedPages });
    setSelectedFieldIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${projectId}/report-templates/${templateId}`, {
        name: template.name,
        status: template.status,
        pages: template.pages,
      });
      toast.success('บันทึก template แล้ว');
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadBackground = async () => {
    if (!bgFile) return;
    setUploadingBg(true);
    try {
      const fd = new FormData();
      fd.append('background', bgFile);
      const { data } = await api.post(
        `/projects/${projectId}/report-templates/${templateId}/background/${currentPage.pageNo}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setTemplate(data.data);
      setBgFile(null);
      toast.success('อัปโหลด background แล้ว');
    } catch (err) {
      toast.error(err.response?.data?.message || 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleDeleteBackground = async () => {
    if (!window.confirm('ยืนยันลบ background?')) return;
    try {
      const { data } = await api.delete(
        `/projects/${projectId}/report-templates/${templateId}/background/${currentPage.pageNo}`
      );
      setTemplate(data.data);
      toast.success('ลบ background แล้ว');
    } catch (err) {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const handlePreview = async () => {
    if (window.confirm('แนะนำให้บันทึกการแก้ไขก่อนดูตัวอย่าง ต้องการดำเนินการต่อหรือไม่?')) {
      try {
        let endpoint = '';
        if (template.module === 'daily_report') {
          endpoint = `/projects/${projectId}/daily-reports?limit=1`;
        } else if (template.module === 'procurement') {
          endpoint = `/projects/${projectId}/procurement?limit=1`;
        } else if (template.module === 'acceptance') {
          endpoint = `/projects/${projectId}/acceptance?limit=1`;
        }

        const { data } = await api.get(endpoint);
        const records = Array.isArray(data.data) ? data.data : (data.data?.items || []);

        if (!records || records.length === 0) {
          toast.error('ไม่พบข้อมูลจริงในระบบสำหรับโครงการนี้ กรุณาสร้างข้อมูลจริงก่อนเลือกดูตัวอย่าง');
          return;
        }

        const recordId = records[0]._id;
        const previewUrl = `${api.defaults.baseURL}/projects/${projectId}/reports/${template.module}/${recordId}/generate/${templateId}?preview=true`;
        window.open(previewUrl, '_blank');
      } catch (err) {
        toast.error('เกิดข้อผิดพลาดในการดึงข้อมูลตัวอย่าง');
      }
    }
  };

  const handleAddPage = () => {
    const newPageNo = template.pages.length + 1;
    const updatedPages = [...template.pages, {
      pageNo: newPageNo,
      paperSize: 'A4',
      orientation: 'portrait',
      backgroundFile: null,
      fields: []
    }];
    setTemplate({ ...template, pages: updatedPages });
    setCurrentPageIndex(updatedPages.length - 1);
    toast.success(`เพิ่มหน้า ${newPageNo} แล้ว`);
  };

  const handleDeletePage = async () => {
    if (template.pages.length <= 1) {
      toast.error('ต้องมีอย่างน้อย 1 หน้า');
      return;
    }
    if (!window.confirm(`ยืนยันลบหน้า ${currentPage.pageNo}?`)) return;

    const updatedPages = template.pages.filter((_, idx) => idx !== currentPageIndex);
    // เรียงเลขหน้าใหม่
    updatedPages.forEach((page, idx) => {
      page.pageNo = idx + 1;
    });

    setTemplate({ ...template, pages: updatedPages });
    setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
    toast.success('ลบหน้าแล้ว');
  };

  const handlePageSettingChange = (key, value) => {
    const updatedPages = template.pages.map((page, idx) => {
      if (idx !== currentPageIndex) return page;
      return { ...page, [key]: value };
    });
    setTemplate({ ...template, pages: updatedPages });
  };

  const handlePointerDown = (e, index, action) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldIndex(index);

    const field = template.pages[currentPageIndex].fields[index];
    const scaleFactor = canvasScale.scale;

    dragStartRef.current = {
      action, // 'drag' or 'resize'
      index,
      startX: e.clientX,
      startY: e.clientY,
      fieldX: field.x,
      fieldY: field.y,
      fieldWidth: field.width,
      fieldHeight: field.height,
      scaleFactor,
      pageIndex: currentPageIndex,
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!dragStartRef.current) return;
    const { action, index, startX, startY, fieldX, fieldY, fieldWidth, fieldHeight, scaleFactor, pageIndex } = dragStartRef.current;

    const screenDx = e.clientX - startX;
    const screenDy = e.clientY - startY;

    const logicalDx = Math.round(screenDx / scaleFactor);
    const logicalDy = Math.round(screenDy / scaleFactor);

    setTemplate((prevTemplate) => {
      if (!prevTemplate) return prevTemplate;
      const updatedPages = [...prevTemplate.pages];
      const pageFields = updatedPages[pageIndex].fields;
      if (!pageFields || !pageFields[index]) return prevTemplate;

      if (action === 'drag') {
        const newX = Math.max(0, Math.min(canvasWidth - fieldWidth, fieldX + logicalDx));
        const newY = Math.max(0, Math.min(canvasHeight - fieldHeight, fieldY + logicalDy));
        pageFields[index] = {
          ...pageFields[index],
          x: newX,
          y: newY,
        };
      } else if (action === 'resize') {
        const newWidth = Math.max(20, Math.min(canvasWidth - fieldX, fieldWidth + logicalDx));
        const newHeight = Math.max(10, Math.min(canvasHeight - fieldY, fieldHeight + logicalDy));
        pageFields[index] = {
          ...pageFields[index],
          width: newWidth,
          height: newHeight,
        };
      }

      return { ...prevTemplate, pages: updatedPages };
    });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parentRect = containerRef.current.getBoundingClientRect();
        const parentW = parentRect.width - 24; // 12px margin each side
        const parentH = parentRect.height - 24;

        if (parentW > 0 && parentH > 0) {
          const logicalW = canvasWidth;
          const logicalH = canvasHeight;

          const scaleX = parentW / logicalW;
          const scaleY = parentH / logicalH;
          const fitScale = scaleX;

          setCanvasScale({
            width: Math.floor(logicalW * fitScale),
            height: Math.floor(logicalH * fitScale),
            scale: fitScale,
          });
        }
      }
    };

    updateScale();
    const timer = setTimeout(updateScale, 150);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScale);
    };
  }, [template, currentPageIndex, canvasWidth, canvasHeight]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!template) return null;



  return (
    <>
      {/* Mobile Warning - แสดงเฉพาะบน mobile */}
      <MobileWarning feature="Template Designer" />

      {/* Desktop UI - แสดงเฉพาะบน desktop (lg+) */}
      <div className="hidden lg:block min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <Link
                  to={`/projects/${projectId}/report-manager`}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  ← กลับ
                </Link>
                <div>
                  <h1 className="font-bold text-gray-800">{template.name}</h1>
                  <p className="text-xs text-gray-500">Template Designer · {template.module}</p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-primary text-white rounded-lg px-4 py-2 hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>

            {/* Page Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Page Selection */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">หน้า:</label>
                <div className="flex gap-1">
                  {template.pages.map((page, index) => (
                    <button
                      key={page.pageNo}
                      onClick={() => {
                        setCurrentPageIndex(index);
                        setSelectedFieldIndex(null);
                      }}
                      className={`text-xs px-2 py-1 rounded ${index === currentPageIndex
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {page.pageNo}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddPage}
                  className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  title="เพิ่มหน้า"
                >
                  + หน้า
                </button>
                {template.pages.length > 1 && (
                  <button
                    onClick={handleDeletePage}
                    className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    title="ลบหน้าปัจจุบัน"
                  >
                    ลบหน้า
                  </button>
                )}
              </div>

              {/* Paper Size */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">ขนาด:</label>
                <select
                  value={currentPage?.paperSize || 'A4'}
                  onChange={(e) => handlePageSettingChange('paperSize', e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              {/* Orientation */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">ทิศทาง:</label>
                <select
                  value={currentPage?.orientation || 'portrait'}
                  onChange={(e) => handlePageSettingChange('orientation', e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="portrait">แนวตั้ง</option>
                  <option value="landscape">แนวนอน</option>
                </select>
              </div>

              {/* Background Upload/Delete & Preview */}
              <div className="flex items-center gap-2">
                {currentPage?.backgroundFile ? (
                  <button
                    onClick={handleDeleteBackground}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-300 rounded"
                  >
                    ลบพื้นหลัง
                  </button>
                ) : (
                  <>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setBgFile(e.target.files[0])}
                      className="text-xs"
                      id="bg-upload"
                      style={{ width: '150px' }}
                    />
                    {bgFile && (
                      <button
                        onClick={handleUploadBackground}
                        disabled={uploadingBg}
                        className="text-xs bg-blue-500 text-white rounded px-2 py-1 hover:bg-blue-600 disabled:opacity-50"
                      >
                        {uploadingBg ? 'อัปโหลด...' : 'อัปโหลด'}
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={handlePreview}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded border border-transparent shadow-sm transition flex items-center gap-1 font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  แสดงตัวอย่าง
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Layout 3 คอลัมน์: 25% | 50% | 25% */}
        <div className="flex-1 w-full px-4 py-4 grid grid-cols-12 gap-4 items-stretch min-h-0 overflow-hidden">
          {/* Field Palette (25% -> col-span-3) */}
          <aside className="col-span-3 min-w-0 h-full">
            <div className="bg-white rounded-xl shadow p-4 h-full flex flex-col">
              <h3 className="font-bold text-gray-800 mb-2 flex-none">Field Palette</h3>
              <p className="text-xs text-gray-500 mb-4">เลือกข้อมูลที่ต้องการจากดรอปดาวน์หรือปุ่มเครื่องมือด้านล่างเพื่อเพิ่มลงในรายงานหลัก</p>

              <button
                onClick={() => handleAddField('static_text')}
                className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg p-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 mb-4 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                + เพิ่มกล่องข้อความอิสระ
              </button>

              <div className="flex flex-col gap-2 flex-none">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddField(e.target.value);
                      e.target.value = ""; // Reset dropdown
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-sm cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>-- เลือกข้อมูลเพื่อเพิ่มลงในรายงาน --</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label} ({field.id})
                    </option>
                  ))}
                </select>

                {imageFields.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddImageField(e.target.value);
                        e.target.value = ""; // Reset dropdown
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-sm cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>-- เพิ่มรูปภาพ (แกลเลอรี) --</option>
                    {imageFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Decorative placeholder to make sidebar look premium */}
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6 mt-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <h4 className="text-sm font-semibold text-gray-600 mb-1">ลากวางและปรับขนาดได้อิสระ</h4>
                <p className="text-xs text-gray-400 max-w-[200px]">คลิกเลือกฟิลด์บนผ้าใบเพื่อย้ายตำแหน่งด้วยการลาก หรือย่อขยายขนาดที่มุมกล่อง</p>
              </div>
            </div>
          </aside>

          {/* Canvas Area (50% -> col-span-6) */}
          <div ref={containerRef} className="col-span-6 min-w-0 flex flex-col justify-start items-center h-full overflow-y-auto overflow-x-hidden pb-4 pr-1">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg rounded overflow-hidden"
              style={{
                width: `${canvasScale.width}px`,
                height: `${canvasScale.height}px`,
              }}
            >
              {/* ReportDesignerCanvas & Fields Container */}
              <div className="relative w-full h-full">
                {/* Background - ใช้ ReportDesignerCanvas เพื่อแปลง PDF เป็น PNG ก่อนแสดงผล */}
                <ReportDesignerCanvas
                  backgroundUrl={
                    currentPage?.backgroundFile
                      ? `/docs/api/projects/${projectId}/report-templates/${templateId}/background/${currentPage.pageNo}/file`
                      : null
                  }
                  backgroundFileName={currentPage?.backgroundFile}
                  paperSize={currentPage?.paperSize || 'A4'}
                  orientation={currentPage?.orientation || 'portrait'}
                />

                {/* Fields Overlay Container scaled to match Canvas */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      width: `${canvasWidth}px`,
                      height: `${canvasHeight}px`,
                      transform: `scale(${canvasScale.scale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {currentPage?.fields?.map((field, index) => (
                      <div
                        key={index}
                        onPointerDown={(e) => handlePointerDown(e, index, 'drag')}
                        className={`absolute cursor-move border pointer-events-auto select-none ${selectedFieldIndex === index
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-300 hover:border-primary'
                          }`}
                        style={{
                          left: `${field.x}px`,
                          top: `${field.y}px`,
                          width: `${field.width}px`,
                          height: `${field.height}px`,
                          fontSize: `${(field.fontSize || 16) * 0.8}px`,
                          textAlign: field.textAlign || 'left',
                          touchAction: 'none',
                        }}
                      >
                        <div className="px-1 truncate text-gray-700 w-full h-full pointer-events-none">
                          {field.fieldId === 'static_text'
                            ? (field.customText || '[กล่องข้อความอิสระ]')
                            : field.type === 'image'
                              ? `🖼 ${allFieldDefs.find((f) => f.id === field.fieldId)?.label || field.fieldId} (${field.gridRows || 1}x${field.gridCols || 1})`
                              : (allFieldDefs.find((f) => f.id === field.fieldId)?.label || field.fieldId)}
                        </div>
                        {selectedFieldIndex === index && (
                          <div
                            onPointerDown={(e) => handlePointerDown(e, index, 'resize')}
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary cursor-se-resize flex items-center justify-center rounded-tl pointer-events-auto shadow-sm"
                            style={{ zIndex: 10, touchAction: 'none' }}
                          >
                            <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M6 6H0M6 3H3M6 0H6" stroke="white" strokeWidth="1" strokeLinecap="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Properties Panel (25% -> col-span-3) */}
          <aside className="col-span-3 min-w-0 h-full">
            <div className="bg-white rounded-xl shadow p-4 h-full flex flex-col">
              <h3 className="font-bold text-gray-800 mb-3 flex-none">Properties</h3>
              {selectedFieldIndex !== null && currentPage?.fields?.[selectedFieldIndex] ? (
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {(() => {
                    const field = currentPage.fields[selectedFieldIndex];
                    return (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Field</label>
                          <p className="text-sm font-medium">
                            {field.fieldId === 'static_text' ? 'กล่องข้อความอิสระ' : (allFieldDefs.find((f) => f.id === field.fieldId)?.label || field.fieldId)}
                          </p>
                        </div>
                        {field.fieldId === 'static_text' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">ข้อความในกล่อง (Text)</label>
                            <textarea
                              value={field.customText || ''}
                              onChange={(e) =>
                                handleFieldChange(selectedFieldIndex, 'customText', e.target.value)
                              }
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-sm"
                              placeholder="พิมพ์ข้อความที่นี่..."
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">X</label>
                            <input
                              type="number"
                              value={field.x}
                              onChange={(e) =>
                                handleFieldChange(selectedFieldIndex, 'x', Number(e.target.value))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Y</label>
                            <input
                              type="number"
                              value={field.y}
                              onChange={(e) =>
                                handleFieldChange(selectedFieldIndex, 'y', Number(e.target.value))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Width</label>
                            <input
                              type="number"
                              value={field.width}
                              onChange={(e) =>
                                handleFieldChange(selectedFieldIndex, 'width', Number(e.target.value))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Height</label>
                            <input
                              type="number"
                              value={field.height}
                              onChange={(e) =>
                                handleFieldChange(selectedFieldIndex, 'height', Number(e.target.value))
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                        {field.type === 'image' ? (
                          <>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">รูปแบบเค้าโครง (แถว x คอลัมน์)</label>
                              <select
                                value={GRID_LAYOUT_PRESETS.includes(`${field.gridRows || 1}x${field.gridCols || 1}`) ? `${field.gridRows || 1}x${field.gridCols || 1}` : 'custom'}
                                onChange={(e) => {
                                  if (e.target.value === 'custom') return;
                                  const [r, c] = e.target.value.split('x').map(Number);
                                  handleFieldChange(selectedFieldIndex, 'gridRows', r);
                                  handleFieldChange(selectedFieldIndex, 'gridCols', c);
                                }}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                {GRID_LAYOUT_PRESETS.map((v) => (
                                  <option key={v} value={v}>{v.replace('x', ' x ')}</option>
                                ))}
                                <option value="custom">กำหนดเอง</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">แถว</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="6"
                                  value={field.gridRows || 1}
                                  onChange={(e) =>
                                    handleFieldChange(selectedFieldIndex, 'gridRows', Math.max(1, Number(e.target.value)))
                                  }
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">คอลัมน์</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="6"
                                  value={field.gridCols || 1}
                                  onChange={(e) =>
                                    handleFieldChange(selectedFieldIndex, 'gridCols', Math.max(1, Number(e.target.value)))
                                  }
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">ระยะห่างระหว่างรูป (pt)</label>
                              <input
                                type="number"
                                min="0"
                                value={field.gap ?? 4}
                                onChange={(e) =>
                                  handleFieldChange(selectedFieldIndex, 'gap', Math.max(0, Number(e.target.value)))
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Font Size</label>
                              <input
                                type="number"
                                value={field.fontSize}
                                onChange={(e) =>
                                  handleFieldChange(selectedFieldIndex, 'fontSize', Number(e.target.value))
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Text Align</label>
                              <select
                                value={field.textAlign}
                                onChange={(e) =>
                                  handleFieldChange(selectedFieldIndex, 'textAlign', e.target.value)
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Color</label>
                              <input
                                type="color"
                                value={field.color}
                                onChange={(e) =>
                                  handleFieldChange(selectedFieldIndex, 'color', e.target.value)
                                }
                                className="w-full h-8 border border-gray-300 rounded"
                              />
                            </div>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteField(selectedFieldIndex)}
                          className="w-full text-sm text-red-500 border border-red-200 rounded px-3 py-2 hover:bg-red-50"
                        >
                          ลบ Field
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">เลือก field เพื่อแก้ไข</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
