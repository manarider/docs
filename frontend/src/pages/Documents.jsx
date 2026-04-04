import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Documents() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [types, setTypes] = useState([]);
  const limit = 20;

  const currentFY = new Date().getMonth() >= 9
    ? new Date().getFullYear() + 543 + 1
    : new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentFY - i);

  useEffect(() => {
    api.get('/doctypes').then(({ data }) => setTypes(data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (filterType) params.set('type', filterType);
    if (filterYear) params.set('year', filterYear);
    api.get(`/documents?${params.toString()}`)
      .then(({ data }) => {
        setDocs(data.data);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => toast.error('โหลดเอกสารไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [page, filterType, filterYear]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">รายการเอกสาร</h2>
          {!isAdmin && user?.subDepartment && (
            <p className="text-xs text-gray-400 mt-0.5">แสดงเฉพาะ: {user.subDepartment}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">ทุกประเภท</option>
            {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">ทุกปีงบ</option>
            {yearOptions.map((y) => <option key={y} value={y}>ปีงบ {y}</option>)}
          </select>
          <Link
            to="/documents/new"
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            + เพิ่มเอกสาร
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">ไม่พบเอกสาร</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">ชื่อเอกสาร</th>
                <th className="text-left px-4 py-3 font-medium">หน่วยงาน</th>
                <th className="text-left px-4 py-3 font-medium">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium">ปีงบ</th>
                <th className="text-center px-4 py-3 font-medium">ไฟล์</th>
                <th className="text-center px-4 py-3 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc._id} className="hover:bg-orange-50 transition">
                  <td className="px-4 py-3">
                    <Link
                      to={`/documents/${doc._id}`}
                      className="text-primary font-medium hover:underline line-clamp-2"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.dept_id?.name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{doc.type_id?.name || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.fiscal_year}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">
                      {doc.attachments?.length || 0} ไฟล์
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs text-center">
                    {new Date(doc.createdAt).toLocaleDateString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">ทั้งหมด {total} รายการ</p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  ก่อนหน้า
                </button>
                <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
