import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className={`text-3xl font-bold ${color}`}>{(value || 0).toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 min-w-0 flex-1 truncate" title={label}>{label}</span>
      <div className="w-32 bg-gray-100 rounded-full h-2.5 shrink-0">
        <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

export default function Statistics() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('');

  const currentFY = new Date().getMonth() >= 9
    ? new Date().getFullYear() + 543 + 1
    : new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentFY - i);

  const load = (y) => {
    setLoading(true);
    api.get(`/reports/summary${y ? `?year=${y}` : ''}`)
      .then(({ data: res }) => setData(res.data))
      .catch(() => toast.error('โหลดสถิติไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(''); }, []);

  const maxDept = Math.max(...(data?.byDept || []).map((d) => d.count), 1);
  const maxType = Math.max(...(data?.byType || []).map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          สถิติเอกสาร
          {!isAdmin && user?.subDepartment && (
            <span className="ml-2 text-sm font-normal text-gray-500">({user.subDepartment})</span>
          )}
        </h2>
        <select
          value={year}
          onChange={(e) => { setYear(e.target.value); load(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">ทุกปี</option>
          {yearOptions.map((y) => <option key={y} value={y}>ปีงบ {y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 animate-pulse h-24">
              <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-24" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="เอกสารทั้งหมด" value={data.totalDocs} color="text-primary" />
            <StatCard
              label={year ? `เพิ่มใหม่ปีงบ ${year}` : 'เพิ่มใหม่ปีปัจจุบัน'}
              value={data.newThisYear}
              color="text-green-600"
            />
            {isAdmin && (
              <StatCard label="หน่วยงานที่มีเอกสาร" value={data.byDept?.length || 0} color="text-blue-600" />
            )}
          </div>

          {/* By Dept */}
          {data.byDept?.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold text-gray-700 mb-4">
                จำนวนเอกสารแยกตามหน่วยงาน
                {year && <span className="text-sm font-normal text-gray-400 ml-1">(ปีงบ {year})</span>}
              </h3>
              <div className="space-y-3">
                {data.byDept.map((d) => (
                  <BarRow key={d._id} label={d.deptName} count={d.count} max={maxDept} />
                ))}
              </div>
            </div>
          )}

          {/* By Type */}
          {data.byType?.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold text-gray-700 mb-4">
                จำนวนเอกสารแยกตามประเภท
                {year && <span className="text-sm font-normal text-gray-400 ml-1">(ปีงบ {year})</span>}
              </h3>
              <div className="space-y-3">
                {data.byType.map((t) => (
                  <BarRow key={t._id} label={t.typeName} count={t.count} max={maxType} />
                ))}
              </div>
            </div>
          )}

          {/* Top viewed (admin only) */}
          {isAdmin && data.topViewed?.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold text-gray-700 mb-3">เอกสารที่มีผู้เข้าชมสูงสุด</h3>
              <ol className="space-y-2">
                {data.topViewed.map((doc, i) => (
                  <li key={doc._id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 bg-orange-100 text-primary text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-700 truncate">{doc.title}</span>
                    <span className="text-gray-400 shrink-0">👁 {doc.views}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.totalDocs === 0 && (
            <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p>ยังไม่มีข้อมูลเอกสาร</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

