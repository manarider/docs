import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const MODULES = ['', 'AUTH', 'DOCUMENT', 'DEPARTMENT', 'DOCTYPE', 'ADMIN', 'REPORT'];
const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'REQUEST', 'APPROVE'];
const MIN_PURGE_DAYS = 90;
const DEFAULT_PURGE_DAYS = 120;

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', action: '', username: '' });
  const [page, setPage] = useState(1);
  const limit = 50;

  // Stats & purge state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [purgeDays, setPurgeDays] = useState(DEFAULT_PURGE_DAYS);
  const [showConfirm, setShowConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    api.get('/admin/audit/stats')
      .then(({ data }) => setStats(data.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (filter.module) params.set('module', filter.module);
    if (filter.action) params.set('action', filter.action);
    if (filter.username) params.set('username', filter.username);

    api.get(`/admin/audit?${params}`)
      .then(({ data }) => { setLogs(data.data.logs); setTotal(data.data.total); })
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [page, filter]);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  const handlePurgeDaysChange = (val) => {
    const n = parseInt(val) || DEFAULT_PURGE_DAYS;
    setPurgeDays(Math.max(MIN_PURGE_DAYS, n));
  };

  const handlePurge = async () => {
    if (purgeDays < MIN_PURGE_DAYS) return;
    setPurging(true);
    try {
      const { data } = await api.delete('/admin/audit/purge', { data: { days: purgeDays } });
      toast.success(data.message || `ลบ log เรียบร้อย ${data.data?.deletedCount ?? 0} รายการ`);
      setShowConfirm(false);
      load();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Audit Log</h2>

      {/* Storage Stats & Purge */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-6 items-center justify-between">
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">จำนวน log ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">
              {statsLoading ? '—' : (stats?.total ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">รายการ</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">ขนาดข้อมูล (raw)</p>
            <p className="text-2xl font-bold text-blue-600">
              {statsLoading ? '—' : fmtBytes(stats?.storageSize ?? 0)}
            </p>
            <p className="text-xs text-gray-400">compressed: {statsLoading ? '—' : fmtBytes(stats?.storageSizeCompressed ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">log เก่าสุด</p>
            <p className="text-lg font-semibold text-gray-700">
              {statsLoading ? '—' : stats?.oldestLog ? fmt(stats.oldestLog) : 'ไม่มีข้อมูล'}
            </p>
          </div>
        </div>

        {/* Purge section */}
        <div className="flex flex-wrap items-end gap-3 border-l pl-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              ลบ log ที่มีอายุมากกว่า (วัน)
              <span className="ml-1 text-gray-400">(ต่ำสุด {MIN_PURGE_DAYS} วัน)</span>
            </label>
            <input
              type="number"
              min={MIN_PURGE_DAYS}
              value={purgeDays}
              onChange={(e) => handlePurgeDaysChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 text-center"
            />
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ล้าง Log เก่า
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">ยืนยันการล้าง Log</h3>
            <p className="text-sm text-gray-600 mb-4">
              ต้องการลบ audit log ที่มีอายุ <strong className="text-red-600">มากกว่า {purgeDays} วัน</strong> ออกจากระบบหรือไม่?
              <br />
              <span className="text-xs text-gray-400">การดำเนินการนี้ไม่สามารถยกเลิกได้</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={purging}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-60 flex items-center gap-2"
              >
                {purging && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                ยืนยัน ลบ Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}

      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">โมดูล</label>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filter.module} onChange={(e) => { setPage(1); setFilter({ ...filter, module: e.target.value }); }}>
            {MODULES.map((m) => <option key={m} value={m}>{m || 'ทั้งหมด'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">การกระทำ</label>
          <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filter.action} onChange={(e) => { setPage(1); setFilter({ ...filter, action: e.target.value }); }}>
            {ACTIONS.map((a) => <option key={a} value={a}>{a || 'ทั้งหมด'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ผู้ใช้</label>
          <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="username..."
            value={filter.username}
            onChange={(e) => { setPage(1); setFilter({ ...filter, username: e.target.value }); }} />
        </div>
        <button onClick={load} className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition">
          ค้นหา
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">วันเวลา</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">ผู้ใช้</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">การกระทำ</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">โมดูล</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmt(log.createdAt)}</td>
                    <td className="px-3 py-2 text-gray-800">{log.username}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                        ${log.action === 'DELETE' ? 'bg-red-100 text-red-700'
                          : log.action === 'CREATE' || log.action === 'UPLOAD' ? 'bg-green-100 text-green-700'
                          : log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{log.module}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs font-mono">{log.ip_address}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">‹</button>
                <span className="px-3 py-1 bg-primary text-white rounded-lg">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
