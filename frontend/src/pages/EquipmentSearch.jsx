import { useState, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PdfExportButton from '../components/projects/PdfExportButton';

/* ─── ตารางผลลัพธ์ค้นหาด้วยเลขครุภัณฑ์ ─── */
function EquipResultTable({ results, formatDate }) {
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">พบ {results.length} รายการ</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">เลขครุภัณฑ์</th>
              <th className="text-left px-4 py-3">ชื่อ/รายการ</th>
              <th className="text-left px-4 py-3">Serial No.</th>
              <th className="text-left px-4 py-3">ตำแหน่งปัจจุบัน</th>
              <th className="text-left px-4 py-3">บันทึกล่าสุด</th>
              <th className="text-left px-4 py-3">โครงการ</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold text-purple-700">{r.equipment_no}</td>
                <td className="px-4 py-3 text-gray-700">{r.description || '-'}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.serial_no || '-'}</td>
                <td className="px-4 py-3">
                  {r.current_position
                    ? <span className="text-green-700 font-medium">📍 {r.current_position}</span>
                    : <span className="text-gray-400 italic text-xs">ยังไม่ได้ติดตั้ง</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.last_date)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs leading-snug">{r.project_title || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── ผลลัพธ์ค้นหาด้วยตำแหน่ง ─── */
function PositionResults({ results, formatDate }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">พบ {results.length} ตำแหน่ง</p>
      {results.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-blue-800">📍 {r.position}</p>
              {r.project_titles?.length > 0 && (
                <p className="text-xs text-blue-500 mt-0.5">{r.project_titles.join(' / ')}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0 mt-1">{formatDate(r.latest_date)}</span>
          </div>
          {r.equipment_list?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">เลขครุภัณฑ์</th>
                    <th className="text-left px-4 py-2">ชื่อ/ประเภท</th>
                    <th className="text-left px-4 py-2">Serial No.</th>
                    <th className="text-left px-4 py-2">บันทึกล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {r.equipment_list.map((eq, j) => (
                    <tr key={j} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-400">{j + 1}</td>
                      <td className="px-4 py-2 font-mono font-semibold text-purple-700">{eq.equipment_no || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{eq.equipment_type || '-'}</td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{eq.serial_no || '-'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{formatDate(eq.last_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 p-4">ไม่มีข้อมูลครุภัณฑ์</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── หน้าหลัก ─── */
export default function EquipmentSearch() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('equipment_no');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const printRef = useRef(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const { data } = await api.get('/equipment/search', { params: { q, mode } });
      setResults(data.data);
      setSearchedQuery(q);
    } catch (err) {
      toast.error(err.response?.data?.message || 'ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">🔧 ค้นหาครุภัณฑ์</h1>
        {results?.length > 0 && (
          <PdfExportButton
            contentRef={printRef}
            filename={`ครุภัณฑ์-${searchedQuery}`}
          />
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow p-5 space-y-4">
        {/* mode toggle */}
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              value="equipment_no"
              checked={mode === 'equipment_no'}
              onChange={() => { setMode('equipment_no'); setResults(null); }}
              className="accent-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">
              🔖 ค้นหาด้วย <span className="text-purple-700">เลขครุภัณฑ์</span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              value="position"
              checked={mode === 'position'}
              onChange={() => { setMode('position'); setResults(null); }}
              className="accent-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">
              📍 ค้นหาด้วย <span className="text-blue-700">ตำแหน่ง/สถานที่</span>
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'equipment_no'
                ? 'กรอกเลขครุภัณฑ์ที่ต้องการค้นหา เช่น 4110-001...'
                : 'กรอกชื่อสถานที่ เช่น โรงเรียน...'
            }
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-primary text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? 'กำลังค้นหา...' : '🔍 ค้นหา'}
          </button>
        </div>

        {mode === 'equipment_no' && (
          <p className="text-xs text-gray-400">
            ผลลัพธ์จะแสดง: เลขครุภัณฑ์ · ชื่อรายการ · Serial No. · ตำแหน่งที่ติดตั้งล่าสุด
          </p>
        )}
        {mode === 'position' && (
          <p className="text-xs text-gray-400">
            ผลลัพธ์จะแสดง: ตำแหน่ง/สถานที่ พร้อมรายการครุภัณฑ์ที่ติดตั้งไว้
          </p>
        )}
      </form>

      {/* Results */}
      {results !== null && (
        <div ref={printRef} className="space-y-4">
          {results.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-10 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-gray-500">ไม่พบผลลัพธ์สำหรับ &ldquo;<span className="font-medium text-gray-700">{searchedQuery}</span>&rdquo;</p>
            </div>
          ) : mode === 'equipment_no' ? (
            <EquipResultTable results={results} formatDate={formatDate} />
          ) : (
            <PositionResults results={results} formatDate={formatDate} />
          )}
        </div>
      )}
    </div>
  );
}
