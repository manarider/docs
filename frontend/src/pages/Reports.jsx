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

function fmtBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function StorageSection() {
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/storage')
      .then(({ data }) => setStorage(data.data))
      .catch(() => toast.error('โหลดข้อมูลพื้นที่ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl shadow p-5 animate-pulse">
      <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
      </div>
    </div>
  );

  if (!storage) return null;

  const { totalSize, fileCount, byExt, disk } = storage;
  const diskPct = disk ? Math.min(100, ((disk.used / disk.total) * 100).toFixed(1)) : null;

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <h3 className="font-semibold text-gray-700">พื้นที่จัดเก็บเอกสาร</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{fileCount.toLocaleString()}</p>
          <p className="text-xs text-blue-500 mt-1">ไฟล์ทั้งหมด</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-orange-600">{fmtBytes(totalSize)}</p>
          <p className="text-xs text-orange-400 mt-1">ขนาดที่ใช้</p>
        </div>
        {disk && (
          <>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-600">{fmtBytes(disk.free)}</p>
              <p className="text-xs text-green-500 mt-1">พื้นที่คงเหลือ</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-600">{fmtBytes(disk.total)}</p>
              <p className="text-xs text-gray-400 mt-1">ความจุดิสก์รวม</p>
            </div>
          </>
        )}
      </div>

      {/* Disk usage bar */}
      {diskPct != null && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>การใช้งานดิสก์</span>
            <span>{diskPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${diskPct > 85 ? 'bg-red-500' : diskPct > 70 ? 'bg-yellow-400' : 'bg-green-500'}`}
              style={{ width: `${diskPct}%` }}
            />
          </div>
          {diskPct > 85 && (
            <p className="text-xs text-red-600 mt-1">⚠️ พื้นที่เหลือน้อย กรุณาตรวจสอบ</p>
          )}
        </div>
      )}

      {/* File by extension */}
      {byExt && Object.keys(byExt).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">แยกตามประเภทไฟล์</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byExt)
              .sort((a, b) => b[1] - a[1])
              .map(([ext, cnt]) => (
                <span key={ext} className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">
                  {ext} <span className="font-semibold">{cnt}</span>
                </span>
              ))}
          </div>
        </div>
      )}
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

          {/* Storage (admin only) */}
          {isAdmin && <StorageSection />}

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

