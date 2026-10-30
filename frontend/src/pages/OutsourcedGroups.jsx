import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, staff: 25, member: 20, viewer: 10 };

export default function OutsourcedGroups() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canManage = (ROLE_LEVEL[user?.role] || 0) >= ROLE_LEVEL.staff;
    const isAdmin = (ROLE_LEVEL[user?.role] || 0) >= ROLE_LEVEL.admin;

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    // คณะกรรมการตรวจรับ (เฉพาะ admin)
    const [committeeGroup, setCommitteeGroup] = useState(null);
    const [committeeMembers, setCommitteeMembers] = useState([]);
    const [committeeLoading, setCommitteeLoading] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [memberSaving, setMemberSaving] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [editingMemberName, setEditingMemberName] = useState('');

    // โปรไฟล์เจ้าหน้าที่ (ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง) — เฉพาะ admin แก้ไขของผู้อื่นได้
    const [profileGroup, setProfileGroup] = useState(null);
    const [staffProfiles, setStaffProfiles] = useState([]);
    const [profilesLoading, setProfilesLoading] = useState(false);
    const [editingProfileUserId, setEditingProfileUserId] = useState(null);
    const [editingProfileForm, setEditingProfileForm] = useState({ position: '', contract_number: '' });
    const [profileSaving, setProfileSaving] = useState(false);

    const load = () => {
        setLoading(true);
        api.get('/outsourced/groups')
            .then(({ data }) => setGroups(data.data))
            .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditTarget(null); setForm({ name: '', description: '' }); setShowForm(true); };
    const openEdit = (g) => { setEditTarget(g); setForm({ name: g.name, description: g.description || '' }); setShowForm(true); };

    const handleSave = async () => {
        if (!form.name.trim()) return toast.error('กรุณาระบุชื่อกลุ่มงาน');
        setSaving(true);
        try {
            if (editTarget) {
                await api.patch(`/outsourced/groups/${editTarget._id}`, form);
                toast.success('อัปเดตเรียบร้อย');
            } else {
                await api.post('/outsourced/groups', form);
                toast.success('สร้างกลุ่มงานเรียบร้อย');
            }
            setShowForm(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (g) => {
        try {
            await api.patch(`/outsourced/groups/${g._id}`, { isActive: !g.isActive });
            toast.success(g.isActive ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
            load();
        } catch {
            toast.error('เกิดข้อผิดพลาด');
        }
    };

    const handleDelete = async (g) => {
        if (!confirm(`ยืนยันลบกลุ่มงาน "${g.name}"?`)) return;
        try {
            await api.delete(`/outsourced/groups/${g._id}`);
            toast.success('ลบเรียบร้อย');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    const loadCommittee = (groupId) => {
        setCommitteeLoading(true);
        api.get(`/outsourced/groups/${groupId}/committee`)
            .then(({ data }) => setCommitteeMembers(data.data))
            .catch(() => toast.error('โหลดรายชื่อคณะกรรมการไม่สำเร็จ'))
            .finally(() => setCommitteeLoading(false));
    };

    const openCommittee = (g) => {
        setCommitteeGroup(g);
        setNewMemberName('');
        setEditingMemberId(null);
        loadCommittee(g._id);
    };

    const closeCommittee = () => {
        setCommitteeGroup(null);
        setCommitteeMembers([]);
    };

    const handleAddMember = async () => {
        if (!newMemberName.trim()) return toast.error('กรุณาระบุชื่อคณะกรรมการตรวจรับ');
        setMemberSaving(true);
        try {
            await api.post(`/outsourced/groups/${committeeGroup._id}/committee`, { name: newMemberName.trim() });
            setNewMemberName('');
            toast.success('เพิ่มรายชื่อเรียบร้อย');
            loadCommittee(committeeGroup._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setMemberSaving(false);
        }
    };

    const startEditMember = (member) => {
        setEditingMemberId(member._id);
        setEditingMemberName(member.name);
    };

    const handleSaveMemberEdit = async () => {
        if (!editingMemberName.trim()) return toast.error('กรุณาระบุชื่อคณะกรรมการตรวจรับ');
        setMemberSaving(true);
        try {
            await api.patch(`/outsourced/groups/${committeeGroup._id}/committee/${editingMemberId}`, { name: editingMemberName.trim() });
            setEditingMemberId(null);
            toast.success('อัปเดตรายชื่อเรียบร้อย');
            loadCommittee(committeeGroup._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setMemberSaving(false);
        }
    };

    const handleDeleteMember = async (member) => {
        if (!confirm(`ยืนยันลบ "${member.name}" ออกจากคณะกรรมการตรวจรับ?`)) return;
        try {
            await api.delete(`/outsourced/groups/${committeeGroup._id}/committee/${member._id}`);
            toast.success('ลบเรียบร้อย');
            loadCommittee(committeeGroup._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    const loadStaffProfiles = (groupId) => {
        setProfilesLoading(true);
        api.get(`/outsourced/groups/${groupId}/profiles`)
            .then(({ data }) => setStaffProfiles(data.data))
            .catch(() => toast.error('โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ'))
            .finally(() => setProfilesLoading(false));
    };

    const openStaffProfiles = (g) => {
        setProfileGroup(g);
        setEditingProfileUserId(null);
        loadStaffProfiles(g._id);
    };

    const closeStaffProfiles = () => {
        setProfileGroup(null);
        setStaffProfiles([]);
    };

    const startEditProfile = (staff) => {
        setEditingProfileUserId(staff.user_id);
        setEditingProfileForm({ position: staff.position || '', contract_number: staff.contract_number || '' });
    };

    const handleSaveProfile = async () => {
        if (!editingProfileForm.position.trim()) return toast.error('กรุณาระบุตำแหน่งหน้าที่');
        if (!editingProfileForm.contract_number.trim()) return toast.error('กรุณาระบุเลขที่บันทึกตกลงจ้าง');
        setProfileSaving(true);
        try {
            await api.patch(`/outsourced/groups/${profileGroup._id}/profiles/${editingProfileUserId}`, editingProfileForm);
            setEditingProfileUserId(null);
            toast.success('บันทึกโปรไฟล์เรียบร้อย');
            loadStaffProfiles(profileGroup._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Outsourced — กลุ่มงาน</h2>
                    <p className="text-sm text-gray-500 mt-0.5">เลือกกลุ่มงานเพื่อจัดการฟอร์มการรายงานหรือบันทึกรายงาน</p>
                </div>
                {canManage && (
                    <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition shrink-0">
                        + เพิ่มกลุ่มงาน
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((g) => (
                        <div key={g._id} className="bg-white rounded-xl shadow p-4 space-y-3 border border-gray-100">
                            <div className="flex items-start justify-between">
                                <h3 className="font-semibold text-gray-800">{g.name}</h3>
                                <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {g.isActive ? 'ใช้งาน' : 'ปิดใช้'}
                                </span>
                            </div>
                            {g.description && <p className="text-sm text-gray-500 line-clamp-2">{g.description}</p>}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    onClick={() => navigate(`/outsourced/groups/${g._id}/reports`)}
                                    className="bg-orange-50 text-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                                >
                                    📋 รายงาน
                                </button>
                                {canManage && (
                                    <>
                                        <button
                                            onClick={() => navigate(`/outsourced/groups/${g._id}/forms`)}
                                            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                                        >
                                            🧾 ฟอร์มการรายงาน
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={() => openCommittee(g)}
                                                className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-100 transition"
                                            >
                                                👥 คณะกรรมการตรวจรับ
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button
                                                onClick={() => openStaffProfiles(g)}
                                                className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-100 transition"
                                            >
                                                🪪 โปรไฟล์เจ้าหน้าที่
                                            </button>
                                        )}
                                        <button onClick={() => openEdit(g)} className="text-blue-600 hover:underline text-xs">แก้ไข</button>
                                        <button onClick={() => toggleActive(g)} className="text-yellow-600 hover:underline text-xs">
                                            {g.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                                        </button>
                                        <button onClick={() => handleDelete(g)} className="text-red-600 hover:underline text-xs">ลบ</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-xl shadow">ไม่มีกลุ่มงาน</div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-gray-800">{editTarget ? 'แก้ไขกลุ่มงาน' : 'เพิ่มกลุ่มงานใหม่'}</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อกลุ่มงาน *</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="เช่น งานทำความสะอาด"
                                maxLength={200}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                maxLength={1000}
                            />
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

            {committeeGroup && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">คณะกรรมการตรวจรับ</h3>
                                <p className="text-sm text-gray-500">{committeeGroup.name}</p>
                            </div>
                            <button onClick={closeCommittee} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                        </div>

                        {committeeLoading ? (
                            <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {committeeMembers.map((m) => (
                                    <div key={m._id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                        {editingMemberId === m._id ? (
                                            <>
                                                <input
                                                    autoFocus
                                                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                    value={editingMemberName}
                                                    onChange={(e) => setEditingMemberName(e.target.value)}
                                                    maxLength={200}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveMemberEdit()}
                                                />
                                                <button onClick={handleSaveMemberEdit} disabled={memberSaving} className="text-green-600 hover:underline text-xs shrink-0">บันทึก</button>
                                                <button onClick={() => setEditingMemberId(null)} className="text-gray-500 hover:underline text-xs shrink-0">ยกเลิก</button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                                                <button onClick={() => startEditMember(m)} className="text-blue-600 hover:underline text-xs shrink-0">แก้ไข</button>
                                                <button onClick={() => handleDeleteMember(m)} className="text-red-600 hover:underline text-xs shrink-0">ลบ</button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {committeeMembers.length === 0 && (
                                    <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีรายชื่อคณะกรรมการตรวจรับ</div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <input
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                placeholder="ชื่อ-นามสกุล คณะกรรมการตรวจรับ"
                                maxLength={200}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                            />
                            <button
                                onClick={handleAddMember}
                                disabled={memberSaving}
                                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition disabled:opacity-60 shrink-0"
                            >
                                + เพิ่ม
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {profileGroup && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">โปรไฟล์เจ้าหน้าที่</h3>
                                <p className="text-sm text-gray-500">{profileGroup.name} — ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง ใช้แสดงในรายงาน PDF</p>
                            </div>
                            <button onClick={closeStaffProfiles} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                        </div>

                        {profilesLoading ? (
                            <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {staffProfiles.map((s) => (
                                    <div key={s.user_id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                                        {editingProfileUserId === s.user_id ? (
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-gray-800">{s.name}{s.username ? ` (${s.username})` : ''}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <input
                                                        autoFocus
                                                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                        value={editingProfileForm.position}
                                                        onChange={(e) => setEditingProfileForm({ ...editingProfileForm, position: e.target.value })}
                                                        placeholder="ตำแหน่งหน้าที่"
                                                        maxLength={200}
                                                    />
                                                    <input
                                                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                        value={editingProfileForm.contract_number}
                                                        onChange={(e) => setEditingProfileForm({ ...editingProfileForm, contract_number: e.target.value })}
                                                        placeholder="เลขที่บันทึกตกลงจ้าง"
                                                        maxLength={200}
                                                    />
                                                </div>
                                                <div className="flex gap-3 justify-end">
                                                    <button onClick={() => setEditingProfileUserId(null)} className="text-gray-500 hover:underline text-xs">ยกเลิก</button>
                                                    <button onClick={handleSaveProfile} disabled={profileSaving} className="text-green-600 hover:underline text-xs font-medium disabled:opacity-60">
                                                        {profileSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}{s.username ? ` (${s.username})` : ''}</p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {s.position || <span className="italic text-gray-400">ยังไม่ระบุตำแหน่งหน้าที่</span>}
                                                        {s.contract_number && ` • เลขที่บันทึกตกลงจ้าง ${s.contract_number}`}
                                                    </p>
                                                </div>
                                                <button onClick={() => startEditProfile(s)} className="text-blue-600 hover:underline text-xs shrink-0">แก้ไข</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {staffProfiles.length === 0 && (
                                    <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีเจ้าหน้าที่ส่งรายงานในกลุ่มงานนี้</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
