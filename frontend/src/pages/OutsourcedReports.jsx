/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LocationPicker from '../components/LocationPicker';
import api from '../lib/api';
import toast from 'react-hot-toast';

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, staff: 25, member: 20, viewer: 10 };

function FieldInput({ field, values, setValues, files, setFiles }) {
    const value = values[field.fieldId];
    const setValue = (nextValue) => setValues((previous) => ({ ...previous, [field.fieldId]: nextValue }));
    const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';

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
                    {(field.radioOptions || []).find((option) => option.value === value)?.fields?.map((child) => (
                        <div key={child.fieldId} className="ml-5 border-l-2 border-orange-200 pl-3">
                            <FieldInput field={child} values={values} setValues={setValues} files={files} setFiles={setFiles} />
                        </div>
                    ))}
                    {!field.radioOptions?.length && field.radioSubFields?.[value] && (
                        <div className="ml-5 border-l-2 border-orange-200 pl-3">
                            <FieldInput field={field.radioSubFields[value]} values={values} setValues={setValues} files={files} setFiles={setFiles} />
                        </div>
                    )}
                </div>
            )}
            {field.type === 'checkbox' && (
                <div className="space-y-1.5">
                    {(field.options || []).map((option) => {
                        const selected = Array.isArray(value) ? value : [];
                        return <label key={option} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setValue(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>;
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
            {field.type === 'image' && <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="w-full text-sm" onChange={(event) => setFiles((previous) => ({ ...previous, [field.fieldId]: event.target.files }))} />}
            {['text', 'number'].includes(field.type) && <input type={field.type} className={inputClass} value={value || ''} onChange={(event) => setValue(event.target.value)} />}
        </div>
    );
}

export default function OutsourcedReports() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isStaffUp = (ROLE_LEVEL[user?.role] || 0) >= ROLE_LEVEL.staff;

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

    const selectedForm = forms.find((f) => f._id === selectedFormId) || null;

    // นาฬิกาบอกวันที่/เวลาปัจจุบัน แสดงด้านบนฟอร์มแบบ real-time (ค่าจริงที่บันทึกจะยึดตามเวลา server ตอนกดบันทึก)
    useEffect(() => {
        if (!showForm) return;
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, [showForm]);

    const load = () => {
        setLoading(true);
        Promise.all([
            api.get(`/outsourced/groups/${groupId}`),
            api.get(`/outsourced/groups/${groupId}/forms`),
            api.get(`/outsourced/groups/${groupId}/reports`),
        ])
            .then(([g, f, r]) => { setGroup(g.data.data); setForms(f.data.data); setReports(r.data.data); })
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [groupId]);

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
        try {
            const fd = new FormData();
            fd.append('form_id', selectedFormId);
            fd.append('values', JSON.stringify(values));
            Object.entries(files).forEach(([fieldId, fileList]) => {
                Array.from(fileList || []).forEach((file) => fd.append(fieldId, file));
            });

            await api.post(`/outsourced/groups/${groupId}/reports`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('บันทึกรายงานเรียบร้อย');
            setShowForm(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
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
                                    <td className="px-4 py-3 text-gray-500">{r.submitted_by_username}</td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex gap-3 justify-center">
                                            <a
                                                href={`/docs/api/outsourced/groups/${groupId}/reports/${r._id}/pdf`}
                                                target="_blank" rel="noreferrer"
                                                className="text-blue-600 hover:underline text-xs"
                                            >
                                                ดู PDF
                                            </a>
                                            {(isStaffUp || r.submitted_by_user === user?.userId) && (
                                                <button onClick={() => handleDelete(r)} className="text-red-600 hover:underline text-xs">ลบ</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-10 text-gray-400">ยังไม่มีรายงาน</td></tr>
                            )}
                        </tbody>
                    </table>
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
                                {selectedForm.fields.map((field) => <FieldInput key={field.fieldId} field={field} values={values} setValues={setValues} files={files} setFiles={setFiles} />)}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
                            <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
