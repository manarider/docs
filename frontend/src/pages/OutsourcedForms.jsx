/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
    { value: 'text', label: 'ข้อความสั้น' },
    { value: 'textarea', label: 'ข้อความยาว' },
    { value: 'number', label: 'ตัวเลข' },
    { value: 'select', label: 'ตัวเลือก (Dropdown)' },
    { value: 'radio', label: 'ตัวเลือก (Radio)' },
    { value: 'checkbox', label: 'ตัวเลือก (Checkbox)' },
    { value: 'location', label: 'พิกัด (แผนที่)' },
    { value: 'image', label: 'รูปภาพ' },
    { value: 'table', label: 'ตารางข้อมูล' },
];

function emptyField() {
    return { fieldId: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: '', type: 'text', options: [], optionsInput: '', radioSubFields: {}, radioOptions: [], tableColumns: [], required: false, maxImages: 4 };
}

function emptyColumn() {
    return { columnId: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: '', type: 'text', options: [], optionsInput: '', required: false };
}

function normalizeFieldTree(field) {
    const normalized = {
        ...field,
        optionsInput: field.optionsInput ?? (field.options || []).join(', '),
        tableColumns: (field.tableColumns || []).map((column) => ({
            ...column,
            optionsInput: column.optionsInput ?? (column.options || []).join(', '),
        })),
    };
    if (field.type === 'radio') {
        const options = (field.options || []).map((value) => {
            const existing = (field.radioOptions || []).find((option) => option.value === value);
            const legacy = field.radioSubFields?.[value];
            const fields = existing?.fields || (legacy ? [{ ...legacy, options: [], tableColumns: [], radioOptions: [] }] : []);
            return { value, fields: fields.map(normalizeFieldTree) };
        });
        normalized.radioOptions = options;
    } else {
        normalized.radioOptions = [];
    }
    return normalized;
}

function normalizeFieldsForSave(fields) {
    return fields.map((field) => {
        const savedField = { ...field };
        delete savedField.optionsInput;
        return {
            ...savedField,
            tableColumns: (field.tableColumns || []).filter((column) => column.label.trim()).map((column) => {
                const savedColumn = { ...column };
                delete savedColumn.optionsInput;
                return savedColumn;
            }),
            radioOptions: field.type === 'radio'
                ? (field.options || []).map((value) => ({ value, fields: normalizeFieldsForSave((field.radioOptions || []).find((option) => option.value === value)?.fields || []) }))
            : [],
        };
    });
}

function countSubFields(fields) {
    return fields.reduce((count, field) => count + (field.radioOptions || []).reduce(
        (total, option) => total + (option.fields || []).length + countSubFields(option.fields || []), 0
    ), 0);
}

function FieldListEditor({ fields, onChange, depth = 0, mainFields = [] }) {
    const updateField = (index, patch) => onChange(fields.map((field, current) => current === index ? { ...field, ...patch } : field));
    const moveField = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        const reordered = [...fields];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        onChange(reordered);
    };
    const updateBranch = (fieldIndex, optionValue, nextFields) => {
        const field = fields[fieldIndex];
        updateField(fieldIndex, {
            radioOptions: field.radioOptions.map((option) => option.value === optionValue ? { ...option, fields: nextFields } : option),
        });
    };

    return (
        <div className="space-y-3">
            {fields.map((field, index) => (
                <div key={field.fieldId} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex flex-wrap gap-2">
                        <input
                            className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            value={field.label}
                            onChange={(event) => updateField(index, { label: event.target.value })}
                            placeholder="ชื่อฟิลด์ เช่น รายละเอียดงาน"
                            maxLength={200}
                        />
                        <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" value={field.type} onChange={(event) => updateField(index, {
                            type: event.target.value,
                            radioOptions: event.target.value === 'radio'
                                ? (field.options || []).map((value) => (field.radioOptions || []).find((option) => option.value === value) || { value, fields: [] })
                                : field.radioOptions,
                        })}>
                            {FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="เลื่อนฟิลด์ขึ้น" title="เลื่อนฟิลด์ขึ้น" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronUp size={16} /></button>
                        <button type="button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="เลื่อนฟิลด์ลง" title="เลื่อนฟิลด์ลง" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronDown size={16} /></button>
                        <button type="button" onClick={() => onChange(fields.filter((_, current) => current !== index))} className="text-red-500 text-xs px-2 hover:underline">ลบ</button>
                    </div>

                    {['select', 'checkbox', 'radio'].includes(field.type) && (
                        <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            value={field.optionsInput ?? (field.options || []).join(', ')}
                            onChange={(event) => {
                                const options = [...new Set(event.target.value.split(',').map((value) => value.trim()).filter(Boolean))];
                                const previousOptions = field.radioOptions || [];
                                const radioOptions = [...previousOptions];
                                options.forEach((value, optionIndex) => {
                                    if (radioOptions.some((option) => option.value === value)) return;
                                    const replaced = field.options?.[optionIndex];
                                    const previous = options.length === field.options?.length && !options.includes(replaced)
                                        ? radioOptions.find((option) => option.value === replaced) : null;
                                    radioOptions.push({ value, fields: previous?.fields || [] });
                                });
                                updateField(index, { optionsInput: event.target.value, options, radioOptions });
                            }}
                            placeholder="ตัวเลือก คั่นด้วยจุลภาค เช่น มี, ไม่มี"
                        />
                    )}

                    {field.type === 'radio' && (
                        <div className="space-y-2 pl-3 border-l-2 border-orange-200">
                            {(field.radioOptions || []).filter((option) => field.options?.includes(option.value)).map((option) => (
                                <section key={option.value} className="border border-gray-200 rounded-md bg-white p-3 space-y-2">
                                    <h4 className="text-sm font-semibold text-gray-700">เมื่อเลือก “{option.value}”</h4>
                                    <FieldListEditor
                                        fields={option.fields || []}
                                        mainFields={mainFields}
                                        depth={depth + 1}
                                        onChange={(nextFields) => updateBranch(index, option.value, nextFields)}
                                    />
                                    {depth === 1 && mainFields.length > 0 && (
                                        <select
                                            className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                                            value=""
                                            onChange={(event) => {
                                                const source = mainFields.find((candidate) => candidate.fieldId === event.target.value);
                                                if (source) updateBranch(index, option.value, [...(option.fields || []), { ...source, fieldId: `ref_${source.fieldId}_${Date.now()}`, sourceFieldId: source.fieldId }]);
                                            }}
                                        >
                                            <option value="">+ นำฟิลด์จากฟอร์มหลักมาใช้ร่วมกัน</option>
                                            {mainFields.filter((candidate) => candidate.fieldId !== field.fieldId && candidate.type !== 'radio').map((candidate) => <option key={candidate.fieldId} value={candidate.fieldId}>{candidate.label || 'ฟิลด์ไม่มีชื่อ'}</option>)}
                                        </select>
                                    )}
                                </section>
                            ))}
                            {field.options?.length === 0 && <p className="text-xs text-gray-500">กรอกตัวเลือกโดยคั่นด้วยจุลภาค เพื่อกำหนดฟอร์มย่อยของแต่ละตัวเลือก</p>}
                        </div>
                    )}

                    {field.type === 'table' && (
                        <div className="space-y-2 border-l-2 border-orange-200 pl-3">
                            <p className="text-xs font-medium text-gray-600">คอลัมน์ในตาราง</p>
                            {(field.tableColumns || []).map((column, columnIndex) => (
                                <div key={column.columnId} className="flex flex-wrap gap-2">
                                    <input className="flex-1 min-w-32 border border-gray-300 rounded px-2 py-1.5 text-sm" value={column.label} placeholder="ชื่อคอลัมน์ เช่น ชื่อ" onChange={(event) => updateField(index, { tableColumns: field.tableColumns.map((item, current) => current === columnIndex ? { ...item, label: event.target.value } : item) })} />
                                    <select className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={column.type} onChange={(event) => updateField(index, { tableColumns: field.tableColumns.map((item, current) => current === columnIndex ? { ...item, type: event.target.value } : item) })}>
                                        <option value="text">ข้อความ</option><option value="number">ตัวเลข</option><option value="select">ดรอปดาวน์</option>
                                    </select>
                                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={column.required} onChange={(event) => updateField(index, { tableColumns: field.tableColumns.map((item, current) => current === columnIndex ? { ...item, required: event.target.checked } : item) })} />บังคับกรอก</label>
                                    <button type="button" onClick={() => updateField(index, { tableColumns: field.tableColumns.filter((_, current) => current !== columnIndex) })} className="text-red-500 text-xs px-2">ลบ</button>
                                    {column.type === 'select' && (
                                        <input
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                            value={column.optionsInput ?? (column.options || []).join(', ')}
                                            placeholder="ตัวเลือกดรอปดาวน์ คั่นด้วยจุลภาค"
                                            onChange={(event) => updateField(index, { tableColumns: field.tableColumns.map((item, current) => current === columnIndex ? { ...item, optionsInput: event.target.value, options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean) } : item) })}
                                        />
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={() => updateField(index, { tableColumns: [...(field.tableColumns || []), emptyColumn()] })} className="text-primary text-xs font-medium hover:underline">+ เพิ่มคอลัมน์</button>
                        </div>
                    )}

                    {field.type === 'location' && <p className="text-xs text-gray-500">ระบบจะแสดงแผนที่และปักหมุดตำแหน่งปัจจุบันอัตโนมัติให้ผู้กรอก สามารถเลื่อนหมุดเองได้</p>}
                    {field.type === 'image' && (
                        <label className="flex items-center gap-2 text-xs text-gray-500">จำนวนรูปสูงสุด:
                            <input type="number" min={1} max={10} className="w-16 border border-gray-300 rounded px-2 py-1" value={field.maxImages} onChange={(event) => updateField(index, { maxImages: parseInt(event.target.value, 10) || 4 })} />
                        </label>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />ต้องกรอก</label>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...fields, emptyField()])} className="text-primary text-xs font-medium hover:underline">+ เพิ่มฟิลด์</button>
        </div>
    );
}

export default function OutsourcedForms() {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [group, setGroup] = useState(null);
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [name, setName] = useState('');
    const [fields, setFields] = useState([emptyField()]);
    const [saving, setSaving] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([
            api.get(`/outsourced/groups/${groupId}`),
            api.get(`/outsourced/groups/${groupId}/forms`),
        ])
            .then(([g, f]) => { setGroup(g.data.data); setForms(f.data.data); })
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [groupId]);

    const openCreate = () => { setEditTarget(null); setName(''); setFields([emptyField()]); setShowForm(true); };
    const openEdit = (f) => { setEditTarget(f); setName(f.name); setFields(f.fields.map(normalizeFieldTree)); setShowForm(true); };

    const handleSave = async () => {
        if (!name.trim()) return toast.error('กรุณาระบุชื่อฟอร์ม');
        const cleanFields = fields.filter((f) => f.label.trim());
        if (cleanFields.length === 0) return toast.error('กรุณาระบุฟิลด์อย่างน้อย 1 ฟิลด์');

        const payload = { name, fields: normalizeFieldsForSave(cleanFields) };
        if (editTarget && countSubFields(payload.fields) < countSubFields(editTarget.fields)
            && !confirm('จำนวนฟิลด์ย่อยลดลงจากฟอร์มเดิม ต้องการบันทึกการลบฟิลด์ย่อยหรือไม่?')) return;

        setSaving(true);
        try {
            if (editTarget) {
                await api.patch(`/outsourced/groups/${groupId}/forms/${editTarget._id}`, payload);
                toast.success('อัปเดตเรียบร้อย');
            } else {
                await api.post(`/outsourced/groups/${groupId}/forms`, payload);
                toast.success('สร้างฟอร์มเรียบร้อย');
            }
            setShowForm(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (f) => {
        try {
            await api.patch(`/outsourced/groups/${groupId}/forms/${f._id}`, { status: f.status === 'active' ? 'inactive' : 'active' });
            load();
        } catch {
            toast.error('เกิดข้อผิดพลาด');
        }
    };

    const handleDelete = async (f) => {
        if (!confirm(`ยืนยันลบฟอร์ม "${f.name}"?`)) return;
        try {
            await api.delete(`/outsourced/groups/${groupId}/forms/${f._id}`);
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
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">ฟอร์มการรายงาน — {group?.name}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">กำหนดฟิลด์ที่ต้องกรอกสำหรับกลุ่มงานนี้</p>
                    </div>
                    <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition shrink-0">
                        + เพิ่มฟอร์ม
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
                                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อฟอร์ม</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">จำนวนฟิลด์</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-600">สถานะ</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {forms.map((f) => (
                                <tr key={f._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-800">{f.name}</td>
                                    <td className="px-4 py-3 text-gray-500">{f.fields.length}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${f.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {f.status === 'active' ? 'ใช้งาน' : 'ปิดใช้'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex gap-2 justify-center">
                                            <button onClick={() => openEdit(f)} className="text-blue-600 hover:underline text-xs">แก้ไข</button>
                                            <button onClick={() => toggleStatus(f)} className="text-yellow-600 hover:underline text-xs">
                                                {f.status === 'active' ? 'ปิดใช้' : 'เปิดใช้'}
                                            </button>
                                            <button onClick={() => handleDelete(f)} className="text-red-600 hover:underline text-xs">ลบ</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {forms.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-10 text-gray-400">ยังไม่มีฟอร์ม</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-gray-800">{editTarget ? 'แก้ไขฟอร์ม' : 'สร้างฟอร์มใหม่'}</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อฟอร์ม *</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="เช่น แบบรายงานประจำวัน"
                                maxLength={200}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700">ฟิลด์ในฟอร์ม</label>
                            <FieldListEditor fields={fields} onChange={setFields} mainFields={fields} />
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">ยกเลิก</button>
                            <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60">
                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Link to={`/outsourced/groups/${groupId}/reports`} className="inline-block text-sm text-primary hover:underline">ไปหน้ารายงาน →</Link>
        </div>
    );
}
