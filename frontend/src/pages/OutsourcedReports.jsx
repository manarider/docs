/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LocationPicker from '../components/LocationPicker';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, index) => {
    const month = (index + 9) % 12 + 1;
    return { value: String(month), label: new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(new Date(2024, month - 1, 1)) };
});
const bangkokToday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
const currentYear = Number(bangkokToday.find((part) => part.type === 'year').value) + (Number(bangkokToday.find((part) => part.type === 'month').value) >= 10 ? 544 : 543);

function ImagePreview({ file, onRemove, groupId, setFiles, fieldId }) {
    const [url, setUrl] = useState('');
    const [broken, setBroken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [previewError, setPreviewError] = useState('');
    useEffect(() => {
        let active = true;
        let objectUrl = '';
        setLoading(true);
        setBroken(false);
        setPreviewError('');
        setUrl('');
        const setPreview = (blob) => {
            if (!active) return;
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
        };
        if (/\.(heic|heif)$/i.test(file.name)) {
            const formData = new FormData();
            formData.append('image', file);
            api.post(`/outsourced/groups/${groupId}/report-image-preview`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                responseType: 'blob',
            })
                .then(({ data }) => {
                    if (!active) return;
                    const jpegName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
                    const jpegFile = new File([data], jpegName, { type: 'image/jpeg', lastModified: file.lastModified });
                    setFiles((previous) => ({
                        ...previous,
                        [fieldId]: (previous[fieldId] || []).map((item) => item === file ? jpegFile : item),
                    }));
                })
                .catch(async (error) => {
                    if (!active) return;
                    let message = error.response?.data?.message;
                    if (!message && error.response?.data instanceof Blob) {
                        try {
                            const payload = JSON.parse(await error.response.data.text());
                            message = payload.message;
                        } catch {
                            message = '';
                        }
                    }
                    if (active) {
                        setPreviewError(message || 'แปลงภาพไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองอีกครั้ง');
                        setBroken(true);
                        setLoading(false);
                    }
                });
        } else {
            setPreview(file);
        }
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [file, groupId, setFiles, fieldId]);

    return (
        <div className="relative w-20 h-20 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shrink-0">
            {url && !broken && (
                <img
                    src={url}
                    alt={file.name}
                    onLoad={() => setLoading(false)}
                    onError={() => { setBroken(true); setLoading(false); }}
                    className={`w-full h-full object-cover ${loading ? 'invisible' : ''}`}
                />
            )}
            {broken && (
                <span title={previewError || file.name} className="flex h-full items-center justify-center px-1 text-center text-[10px] text-gray-500 break-all">
                    {previewError || file.name}
                </span>
            )}
            {loading && !broken && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/80">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
                    <span className="text-[9px] text-gray-500">กำลังเตรียมรูป...</span>
                </div>
            )}
            <button
                type="button"
                onClick={onRemove}
                aria-label="ลบรูปภาพ"
                title="ลบรูปภาพ"
                className="absolute top-0.5 right-0.5 flex min-w-6 min-h-6 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80"
            >
                ✕
            </button>
        </div>
    );
}

function FieldInput({ field, values, setValues, files, setFiles, groupId }) {
    const value = values[field.fieldId];
    const setValue = (nextValue) => setValues((previous) => ({ ...previous, [field.fieldId]: nextValue }));
    const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';
    const radioFields = (field.radioOptions || []).find((option) => option.value === value)?.fields || [];
    const children = radioFields.length ? radioFields : (field.radioSubFields?.[value] ? [field.radioSubFields[value]] : []);

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
            {field.type === 'textarea' && <textarea className={inputClass} rows={3} value={value || ''} onChange={(event) => setValue(event.target.value)} />}
            {field.type === 'select' && (
                <select className={inputClass} value={value || ''} onChange={(event) => setValue(event.target.value)}>
                    <option value="">-- เลือก --</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
            )}
            {field.type === 'radio' && (
                <div className="space-y-2">
                    {(field.options || []).map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="radio" name={field.fieldId} value={option} checked={value === option} onChange={() => setValue(option)} />{option}
                        </label>
                    ))}
                    {children.map((child) => (
                        <div key={child.fieldId} className="ml-5 border-l-2 border-orange-200 pl-3">
                            <FieldInput field={child} values={values} setValues={setValues} files={files} setFiles={setFiles} groupId={groupId} />
                        </div>
                    ))}
                </div>
            )}
            {field.type === 'checkbox' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 border border-gray-200 rounded-lg overflow-hidden">
                    {(field.options || []).map((option, optionIndex) => {
                        const selected = Array.isArray(value) ? value : [];
                        const options = field.options || [];
                        const isLastRow = Math.floor(optionIndex / 2) === Math.floor((options.length - 1) / 2);
                        const isLeftColumn = optionIndex % 2 === 0;
                        return (
                            <label
                                key={option}
                                className={`flex items-center gap-2 text-sm text-gray-700 px-3 py-2.5 min-h-10 ${!isLastRow ? 'border-b border-gray-200' : ''} ${isLeftColumn ? 'sm:border-r sm:border-gray-200' : ''}`}
                            >
                                <input type="checkbox" checked={selected.includes(option)} onChange={(event) => setValue(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}
                            </label>
                        );
                    })}
                </div>
            )}
            {field.type === 'table' && (
                <div className="space-y-2">
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full min-w-max text-sm">
                            <thead className="bg-gray-50"><tr>{(field.tableColumns || []).map((column) => <th key={column.columnId} className="px-3 py-2 text-left font-medium text-gray-600">{column.label}{column.required && <span className="text-red-500"> *</span>}</th>)}<th className="w-14 px-2 py-2" /></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {(Array.isArray(value) ? value : []).map((row, rowIndex) => (
                                    <tr key={row.rowId || rowIndex}>
                                        {(field.tableColumns || []).map((column) => <td key={column.columnId} className="p-2">{column.type === 'select' ? (
                                            <select className="w-full min-w-32 border border-gray-300 rounded px-2 py-1.5" value={row[column.columnId] ?? ''} onChange={(event) => setValue(value.map((item, index) => index === rowIndex ? { ...item, [column.columnId]: event.target.value } : item))}>
                                                <option value="">-- เลือก --</option>{(column.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        ) : (
                                            <input type={column.type === 'number' ? 'number' : 'text'} className="w-full min-w-28 border border-gray-300 rounded px-2 py-1.5" value={row[column.columnId] ?? ''} onChange={(event) => setValue(value.map((item, index) => index === rowIndex ? { ...item, [column.columnId]: event.target.value } : item))} />
                                        )}</td>)}
                                        <td className="px-2 text-center"><button type="button" aria-label="ลบแถว" title="ลบแถว" onClick={() => setValue(value.filter((_, index) => index !== rowIndex))} className="min-w-10 min-h-10 text-red-600">−</button></td>
                                    </tr>
                                ))}
                                {(!Array.isArray(value) || value.length === 0) && <tr><td colSpan={(field.tableColumns || []).length + 1} className="px-3 py-4 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={() => setValue([...(Array.isArray(value) ? value : []), { rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }])} className="text-primary text-xs font-medium hover:underline">+ เพิ่มแถว</button>
                </div>
            )}
            {field.type === 'location' && <LocationPicker value={value || null} onChange={setValue} />}
            {field.type === 'image' && (() => {
                const selectedFiles = files[field.fieldId] || [];
                const maxImages = field.maxImages || 4;
                return (
                    <div className="space-y-2">
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                            multiple
                            className="w-full text-sm"
                            onChange={(event) => {
                                const picked = Array.from(event.target.files || []);
                                event.target.value = '';
                                if (!picked.length) return;
                                setFiles((previous) => {
                                    const merged = [...(previous[field.fieldId] || []), ...picked];
                                    if (merged.length > maxImages) toast.error(`อัปโหลดได้สูงสุด ${maxImages} รูป`);
                                    return { ...previous, [field.fieldId]: merged.slice(0, maxImages) };
                                });
                            }}
                        />
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedFiles.map((file, fileIndex) => (
                                    <ImagePreview
                                        key={`${file.name}_${file.lastModified}_${fileIndex}`}
                                        file={file}
                                            groupId={groupId}
                                            setFiles={setFiles}
                                            fieldId={field.fieldId}
                                        onRemove={() => setFiles((previous) => ({ ...previous, [field.fieldId]: (previous[field.fieldId] || []).filter((_, index) => index !== fileIndex) }))}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}
            {['text', 'number'].includes(field.type) && <input type={field.type} className={inputClass} value={value || ''} onChange={(event) => setValue(event.target.value)} />}
        </div>
    );
}

export default function OutsourcedReports() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const canSeeAll = ['admin', 'superadmin'].includes(user?.role);

    const [group, setGroup] = useState(null);
    const [forms, setForms] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedFormId, setSelectedFormId] = useState('');
    const [now, setNow] = useState(new Date());
    const [values, setValues] = useState({});
    const [files, setFiles] = useState({}); // fieldId -> FileList
    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [fiscalYear, setFiscalYear] = useState('');
    const [month, setMonth] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    const selectedForm = forms.find((f) => f._id === selectedFormId) || null;

    // นาฬิกาบอกวันที่/เวลาปัจจุบัน แสดงด้านบนฟอร์มแบบ real-time (ค่าจริงที่บันทึกจะยึดตามเวลา server ตอนกดบันทึก)
    useEffect(() => {
        if (!showForm) return;
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, [showForm]);

    useEffect(() => {
        const timer = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const load = () => {
        let active = true;
        setLoading(true);
        const params = { page, limit: 20 };
        if (search) params.search = search;
        if (fiscalYear) params.fiscalYear = fiscalYear;
        if (month) params.month = month;
        Promise.all([
            api.get(`/outsourced/groups/${groupId}`),
            api.get(`/outsourced/groups/${groupId}/forms`),
            api.get(`/outsourced/groups/${groupId}/reports`, { params }),
        ])
            .then(([g, f, r]) => {
                if (!active) return;
                setGroup(g.data.data); setForms(f.data.data); setReports(r.data.data); setPagination(r.data.pagination);
            })
            .catch(() => { if (active) toast.error('โหลดข้อมูลไม่สำเร็จ'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => load(), [groupId, page, search, fiscalYear, month]);

    const openCreate = () => {
        const activeForms = forms.filter((f) => f.status === 'active');
        if (activeForms.length === 0) return toast.error('กลุ่มงานนี้ยังไม่มีฟอร์มการรายงานที่ใช้งานได้');
        setSelectedFormId(activeForms[0]._id);
        setNow(new Date());
        setValues({});
        setFiles({});
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!selectedFormId) return toast.error('กรุณาเลือกฟอร์มการรายงานก่อน');

        setSaving(true);
        setUploadProgress(0);
        try {
            const fd = new FormData();
            fd.append('form_id', selectedFormId);
            fd.append('values', JSON.stringify(values));
            Object.entries(files).forEach(([fieldId, fileList]) => {
                Array.from(fileList || []).forEach((file) => fd.append(fieldId, file));
            });

            await api.post(`/outsourced/groups/${groupId}/reports`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (event) => {
                    if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
                },
            });
            toast.success('บันทึกรายงานเรียบร้อย');
            setShowForm(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (r) => {
        if (!confirm('ยืนยันลบรายงานนี้?')) return;
        try {
            await api.delete(`/outsourced/groups/${groupId}/reports/${r._id}`);
            toast.success('ลบเรียบร้อย');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <button onClick={() => navigate('/outsourced')} className="text-sm text-gray-500 hover:text-primary mb-2">← กลุ่มงานทั้งหมด</button>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">รายงาน — {group?.name}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">บันทึกการปฏิบัติงานตามฟอร์มที่กำหนดไว้ของกลุ่มงานนี้</p>
                    </div>
                    <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition shrink-0">
                        + บันทึกรายงาน
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded-lg shadow">
                <label className="flex-1 min-w-52 text-sm font-medium text-gray-700">
                    ค้นหารายงาน
                    <span className="relative mt-1 block">
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" aria-hidden="true" />
                        <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ชื่อฟอร์ม ผู้บันทึก หรือข้อมูลในรายงาน" className="w-full min-h-10 rounded-lg border border-gray-300 pl-10 pr-3 text-sm font-normal" />
                    </span>
                </label>
                <label className="text-sm font-medium text-gray-700">
                    ปีงบประมาณ
                    <select value={fiscalYear} onChange={(event) => { setFiscalYear(event.target.value); setMonth(''); setPage(1); }} className="mt-1 block min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-normal">
                        <option value="">ทุกปี</option>
                        {Array.from({ length: 15 }, (_, index) => currentYear + 1 - index).map((year) => <option key={year} value={year}>พ.ศ. {year}</option>)}
                    </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                    เดือน
                    <select value={month} disabled={!fiscalYear} onChange={(event) => { setMonth(event.target.value); setPage(1); }} className="mt-1 block min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-normal disabled:bg-gray-100 disabled:text-gray-400">
                        <option value="">ทุกเดือน</option>
                        {MONTHS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
            ) : (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">วันที่</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">ฟอร์ม</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">ผู้บันทึก</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reports.map((r) => (
                                <tr key={r._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-800">{new Date(r.report_date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                    <td className="px-4 py-3 text-gray-500">{r.form_id?.name || '-'}</td>
                                    <td className="px-4 py-3 text-gray-500">{r.submitted_by_name || r.submitted_by_username}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex gap-3 justify-center">
                                            <a
                                                href={`/docs/api/outsourced/groups/${groupId}/reports/${r._id}/pdf`}
                                                target="_blank" rel="noreferrer"
                                                className="text-blue-600 hover:underline text-xs"
                                            >
                                                ดู PDF
                                            </a>
                                            {(canSeeAll || String(r.submitted_by_user) === String(user?.userId)) && (
                                                <button onClick={() => handleDelete(r)} className="text-red-600 hover:underline text-xs">ลบ</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-10 text-gray-400">ไม่พบรายงาน</td></tr>
                            )}
                        </tbody>
                    </table>
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
                            <span>พบ {pagination.total} รายการ</span>
                            <div className="flex items-center gap-3">
                                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-10 px-2 text-primary disabled:text-gray-400">ก่อนหน้า</button>
                                <span>{page} / {pagination.totalPages}</span>
                                <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="min-h-10 px-2 text-primary disabled:text-gray-400">ถัดไป</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-gray-800">บันทึกรายงานการปฏิบัติงาน</h3>

                        <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                            <span>📅 วันที่: <strong className="text-gray-800">{now.toLocaleDateString('th-TH', { dateStyle: 'long' })}</strong></span>
                            <span>🕐 เวลา: <strong className="text-gray-800">{now.toLocaleTimeString('th-TH')}</strong></span>
                            <span>👤 ผู้บันทึก: <strong className="text-gray-800">{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username}</strong></span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ฟอร์มการรายงาน *</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                value={selectedFormId}
                                onChange={(e) => { setSelectedFormId(e.target.value); setValues({}); setFiles({}); }}
                            >
                                {forms.filter((f) => f.status === 'active').map((f) => (
                                    <option key={f._id} value={f._id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedForm && (
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                {selectedForm.fields.map((field) => <FieldInput key={field.fieldId} field={field} values={values} setValues={setValues} files={files} setFiles={setFiles} groupId={groupId} />)}
                            </div>
                        )}

                        {saving && (
                            <div className="space-y-1">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                    <div className="h-full bg-primary transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                                </div>
                                <p className="text-center text-xs text-gray-500">
                                    {uploadProgress >= 100 ? 'กำลังประมวลผลข้อมูล กรุณารอสักครู่...' : `กำลังอัปโหลด ${uploadProgress}%`}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setShowForm(false)} disabled={saving} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">ยกเลิก</button>
                            <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}        </div>
    );
}