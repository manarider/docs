import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

const ROLE_LABEL = {
  contractor: 'ผู้รับจ้าง',
  supervisor: 'ผู้ควบคุมงาน',
  project_manager: 'ผู้จัดการโครงการ',
};

const ROLE_COLOR = {
  contractor: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-green-100 text-green-700',
  project_manager: 'bg-purple-100 text-purple-700',
};

function KeyCard({ keyItem, projectId, onUpdated, newToken }) {
  const [tokenVisible, setTokenVisible] = useState(false);
  const [activeToken, setActiveToken] = useState(null); // token ที่แสดงอยู่ (newToken หรือ regenerated)
  const [extending, setExtending] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // เมื่อ parent ส่ง newToken มาให้ใหม่ (หลัง modal ปิด) ให้แสดงทันที
  useEffect(() => {
    if (newToken) { setActiveToken(newToken); setTokenVisible(true); }
  }, [newToken]);

  const isExpired = new Date(keyItem.expires_at) < new Date();

  const handleRegenerate = async () => {
    if (!window.confirm(`สร้าง KEY ใหม่สำหรับ "${keyItem.label}"?\nKEY เดิมจะใช้งานไม่ได้ทันที`)) return;
    setRegenerating(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/keys/${keyItem._id}/regenerate`);
      setActiveToken(data.data.token);
      setTokenVisible(true);
      onUpdated(); // silent refresh — KeyCard ยัง mount อยู่ state ไม่หาย
      toast.success('สร้าง KEY ใหม่แล้ว');
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`ลบ KEY "${keyItem.label}" ออกจากระบบถาวร?\nไม่สามารถกู้คืนได้`)) return;
    setLoading(true);
    try {
      await api.delete(`/projects/${projectId}/keys/${keyItem._id}`);
      toast.success('ลบ KEY แล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (field, value) => {
    setLoading(true);
    try {
      await api.patch(`/projects/${projectId}/keys/${keyItem._id}`, { [field]: value });
      toast.success('อัปเดต KEY แล้ว');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!extendDate) { toast.error('กรุณาระบุวันหมดอายุใหม่'); return; }
    setLoading(true);
    try {
      await api.patch(`/projects/${projectId}/keys/${keyItem._id}`, { expires_at: extendDate, is_active: true });
      toast.success('ต่ออายุ KEY แล้ว');
      setExtending(false);
      setExtendDate('');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow p-5 border-l-4 ${
      !keyItem.is_active ? 'border-gray-300 opacity-70' :
      isExpired ? 'border-red-400' :
      'border-green-400'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[keyItem.role]}`}>
              {ROLE_LABEL[keyItem.role]}
            </span>
            <span className="font-semibold text-gray-800">{keyItem.label}</span>
            {!keyItem.is_active && <span className="text-xs text-gray-400">(ยกเลิกแล้ว)</span>}
            {keyItem.is_active && isExpired && <span className="text-xs text-red-500">(หมดอายุ)</span>}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-gray-500">
            {activeToken && tokenVisible ? (
              <div className="bg-gray-900 rounded-lg p-2 mb-1">
                <p className="text-gray-400 mb-0.5">KEY:</p>
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="font-mono text-green-400 text-xs break-all select-all">{activeToken}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(activeToken); toast.success('คัดลอก KEY แล้ว'); }}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition"
                    >📋 คัดลอก KEY</button>
                    <button
                      onClick={() => setTokenVisible(false)}
                      className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded border border-gray-600 transition"
                    >ซ่อน</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p>KEY prefix: <span className="font-mono bg-gray-100 px-1 rounded">{keyItem.key_prefix}...</span></p>
                {keyItem.is_active && (
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="text-xs border border-orange-300 text-orange-600 px-2 py-0.5 rounded hover:bg-orange-50 disabled:opacity-50 transition"
                  >{regenerating ? '...' : 'สร้าง KEY ใหม่'}</button>
                )}
              </div>
            )}
            <p>หมดอายุ: <span className={isExpired ? 'text-red-500 font-medium' : ''}>
              {new Date(keyItem.expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
            </span></p>
            {keyItem.last_used_at && (
              <p>ใช้ล่าสุด: {new Date(keyItem.last_used_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          {keyItem.is_active && !isExpired ? (
            <button
              onClick={() => toggle('is_active', false)}
              disabled={loading}
              className="text-xs border border-red-300 text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
            >
              ยกเลิก KEY
            </button>
          ) : (
            <button
              onClick={() => setExtending(true)}
              disabled={loading}
              className="text-xs border border-green-300 text-green-600 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
            >
              ต่ออายุ
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded disabled:opacity-50 transition"
          >
            ลบ
          </button>
        </div>
      </div>

      {extending && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 flex items-center gap-2">
          <input
            type="date"
            value={extendDate}
            onChange={(e) => setExtendDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button onClick={handleExtend} disabled={loading}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50">
            {loading ? '...' : 'ยืนยัน'}
          </button>
          <button onClick={() => setExtending(false)} className="text-xs text-gray-500">ยกเลิก</button>
        </div>
      )}
    </div>
  );
}

function CreateKeyModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({
    role: 'contractor',
    label: '',
    expires_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [createdKeyId, setCreatedKeyId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) { toast.error('กรุณาระบุชื่อกำกับ'); return; }
    if (!form.expires_at) { toast.error('กรุณาระบุวันหมดอายุ'); return; }

    setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/keys`, form);
      setNewToken(data.data.token);
      setCreatedKeyId(String(data.data._id));
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'สร้าง KEY ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (newToken) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-800">สร้าง KEY เรียบร้อย</h3>
            <p className="text-sm text-red-600 mt-1">⚠ กรุณาคัดลอก KEY ก่อนปิด — KEY จะแสดงในรายการจนกว่าจะซ่อน</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-400 mb-1">KEY สำหรับเข้าใช้งาน:</p>
            <p className="font-mono text-green-400 text-sm break-all">{newToken}</p>
          </div>

          <button
            onClick={() => { navigator.clipboard.writeText(newToken); toast.success('คัดลอก KEY แล้ว'); }}
            className="w-full mb-2 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            📋 คัดลอก KEY
          </button>
          <button onClick={() => onClose({ token: newToken, keyId: createdKeyId })} className="w-full bg-primary text-white py-2 rounded-lg text-sm hover:bg-orange-600">
            ปิด (KEY ยังแสดงในรายการ)
          </button>
        </div>
      </div>
    );
  }

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => setForm((f) => ({ ...f, [field]: e.target.value })),
    className: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-gray-800">สร้าง KEY ใหม่</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท *</label>
            <select {...inp('role')}>
              <option value="contractor">ผู้รับจ้าง</option>
              <option value="supervisor">ผู้ควบคุมงาน</option>
              <option value="project_manager">ผู้จัดการโครงการ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อกำกับ *</label>
            <input type="text" placeholder="เช่น บริษัท ABC จำกัด" {...inp('label')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ *</label>
            <input type="date" min={new Date().toISOString().slice(0, 10)} {...inp('expires_at')} />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>หมายเหตุ:</strong> KEY จะแสดงเพียงครั้งเดียวหลังสร้าง กรุณาส่งให้ผู้ใช้ทันที
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">ยกเลิก</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {loading ? 'กำลังสร้าง...' : 'สร้าง KEY'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectKeyManager() {
  const { projectId } = useParams();
  const { project } = useOutletContext();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingToken, setPendingToken] = useState(null); // { keyId, token }

  const fetchKeys = (silent = false) => {
    if (!silent) setLoading(true);
    api.get(`/projects/${projectId}/keys`)
      .then(({ data }) => setKeys(data.data))
      .catch(() => toast.error('โหลด KEY ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKeys(); }, [projectId]);

  const grouped = {
    contractor: keys.filter((k) => k.role === 'contractor'),
    supervisor: keys.filter((k) => k.role === 'supervisor'),
    project_manager: keys.filter((k) => k.role === 'project_manager'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-700">จัดการ KEY ผู้ใช้ภายนอก</h2>
        {project.status === 'active' && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-orange-600 transition">
            + สร้าง KEY ใหม่
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">📋 วิธีใช้งาน KEY</p>
        <p>1. สร้าง KEY และส่งให้ผู้ปฏิบัติงานภายนอก พร้อม link ด้านล่าง</p>
        <p>2. ผู้ใช้ภายนอกเข้าที่:
          <a
            href={`${window.location.origin}/docs/project-access?projectId=${projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 underline font-mono text-xs bg-blue-100 px-1 rounded break-all"
          >{`${window.location.origin}/docs/project-access?projectId=${projectId}`}</a>
        </p>
        <p>3. KEY มีอายุตามที่กำหนด สามารถต่ออายุหรือยกเลิกได้</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([role, roleKeys]) => (
            <div key={role}>
              <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  role === 'contractor' ? 'bg-blue-400' :
                  role === 'supervisor' ? 'bg-green-400' : 'bg-purple-400'
                }`} />
                {ROLE_LABEL[role]} ({roleKeys.length} KEY)
              </h3>
              {roleKeys.length === 0 ? (
                <p className="text-xs text-gray-400 ml-4">ยังไม่มี KEY</p>
              ) : (
                <div className="space-y-2">
                  {roleKeys.map((k) => (
                    <KeyCard
                      key={k._id}
                      keyItem={k}
                      projectId={projectId}
                      onUpdated={() => fetchKeys(true)}
                      newToken={pendingToken?.keyId === String(k._id) ? pendingToken.token : null}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          projectId={projectId}
          onClose={(result) => { setShowCreate(false); if (result?.token) setPendingToken(result); }}
          onCreated={fetchKeys}
        />
      )}
    </div>
  );
}
