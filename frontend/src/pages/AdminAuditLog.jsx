import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const MODULES = ['', 'AUTH', 'DOCUMENT', 'DEPARTMENT', 'DOCTYPE', 'ADMIN', 'REPORT'];
const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'REQUEST', 'APPROVE'];

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', action: '', username: '' });
  const [page, setPage] = useState(1);
  const limit = 50;

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

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Audit Log</h2>

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
