import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function highlight(text, keyword) {
  if (!keyword || !text) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
      : part
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'ใหม่ล่าสุด' },
  { value: 'oldest', label: 'เก่าที่สุด' },
  { value: 'title', label: 'ชื่อ A-Z' },
  { value: 'views', label: 'ดูมากที่สุด' },
];

export default function Search() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role);

  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [dept, setDept] = useState(searchParams.get('dept') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [year, setYear] = useState(searchParams.get('year') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [starred, setStarred] = useState(searchParams.get('starred') === 'true');
  const [page, setPage] = useState(1);

  // starredMap: docId → is_starred (optimistic update)
  const [starredMap, setStarredMap] = useState({});

  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [depts, setDepts] = useState([]);
  const [types, setTypes] = useState([]);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // โหลด departments + doctypes สำหรับ filter dropdown
  useEffect(() => {
    Promise.all([api.get('/departments'), api.get('/doctypes')]).then(([d, t]) => {
      setDepts(d.data.data || []);
      setTypes(t.data.data || []);
    }).catch(() => {});
  }, []);

  // คำนวณ fiscal years ย้อนหลัง 10 ปี
  const currentFY = new Date().getMonth() >= 9
    ? new Date().getFullYear() + 543 + 1
    : new Date().getFullYear() + 543;
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentFY - i);

  const doSearch = useCallback(async (params) => {
    const { q: qp, dept: dp, type: tp, year: yp, sort: sp, page: pg, starred: st } = params;
    setLoading(true);
    setSearched(true);
    try {
      const query = new URLSearchParams();
      if (qp) query.set('q', qp);
      if (dp) query.set('dept', dp);
      if (tp) query.set('type', tp);
      if (yp) query.set('year', yp);
      if (sp) query.set('sort', sp);
      if (st) query.set('starred', 'true');
      query.set('page', pg || 1);
      query.set('limit', 20);

      const { data } = await api.get(`/documents/search?${query.toString()}`);
      setResults(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error('ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search เมื่อ filters เปลี่ยน
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newPage = 1;
      setPage(newPage);
      const sp = { q, dept, type, year, sort, page: newPage };
      if (starred) sp.starred = 'true';
      setSearchParams(sp, { replace: true });
      doSearch({ q, dept, type, year, sort, page: newPage, starred });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dept, type, year, sort, starred]);

  // เมื่อ page เปลี่ยน
  useEffect(() => {
    if (!searched) return;
    const sp = { q, dept, type, year, sort, page };
    if (starred) sp.starred = 'true';
    setSearchParams(sp, { replace: true });
    doSearch({ q, dept, type, year, sort, page, starred });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // โหลดครั้งแรกถ้า URL มี params
  useEffect(() => {
    const initQ = searchParams.get('q') || '';
    const initStarred = searchParams.get('starred') === 'true';
    if (initQ || searchParams.get('dept') || searchParams.get('type') || searchParams.get('year') || initStarred) {
      doSearch({
        q: initQ,
        dept: searchParams.get('dept') || '',
        type: searchParams.get('type') || '',
        year: searchParams.get('year') || '',
        sort: searchParams.get('sort') || 'newest',
        page: 1,
        starred: initStarred,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    setQ(''); setDept(''); setType(''); setYear(''); setSort('newest'); setStarred(false);
    setResults([]); setPagination(null); setSearched(false); setPage(1);
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  };

  const handleToggleStar = async (docId, currentStar) => {
    setStarredMap((m) => ({ ...m, [docId]: !currentStar }));
    try {
      await api.post(`/documents/${docId}/star`);
    } catch {
      setStarredMap((m) => ({ ...m, [docId]: currentStar }));
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const hasFilters = q || dept || type || year || starred;

  // หา sub_title ที่ match keyword สำหรับแสดงใน result card
  const matchedAttachments = (doc) => {
    if (!q) return [];
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return (doc.attachments || []).filter((a) => re.test(a.sub_title));
  };

  const selectClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-gray-800">ค้นหาเอกสาร</h2>

      {/* Search Box */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="ค้นหาจากชื่อเอกสาร, คำอธิบาย, ชื่อไฟล์, แท็ก, หน่วยงาน, ประเภทเอกสาร..."
            autoFocus
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >✕</button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* ★ ติดดาว (ทุก role) */}
          <button
            type="button"
            onClick={() => { setStarred((s) => !s); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition ${
              starred
                ? 'bg-yellow-400 border-yellow-400 text-white font-medium'
                : 'border-gray-300 text-gray-600 hover:bg-yellow-50 hover:border-yellow-300'
            }`}
          >
            ★ {starred ? 'เฉพาะที่ติดดาว' : 'ติดดาว'}
          </button>

          {/* Admin only: หน่วยงาน */}
          {isAdmin && (
            <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} className={selectClass}>
              <option value="">ทุกหน่วยงาน</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          )}

          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={selectClass}>
            <option value="">ทุกประเภทเอกสาร</option>
            {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>

          <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className={selectClass}>
            <option value="">ทุกปีงบประมาณ</option>
            {yearOptions.map((y) => <option key={y} value={y}>ปีงบ {y}</option>)}
          </select>

          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={selectClass}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition"
            >ล้างทั้งหมด</button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-100 rounded w-20" />
                <div className="h-5 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && searched && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              พบ <span className="font-semibold text-gray-800">{pagination?.total || 0}</span> รายการ
              {q && <> ที่ตรงกับ "<span className="text-primary">{q}</span>"</>}
            </p>
            {pagination && pagination.totalPages > 1 && (
              <p className="text-xs text-gray-400">หน้า {pagination.page} / {pagination.totalPages}</p>
            )}
          </div>

          {results.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-gray-500 font-medium">ไม่พบเอกสาร</p>
              {hasFilters && (
                <p className="text-sm text-gray-400 mt-1">ลองปรับเงื่อนไขการค้นหา หรือ
                  <button onClick={handleClear} className="text-primary ml-1 hover:underline">ล้างตัวกรอง</button>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((doc) => {
                const matched = matchedAttachments(doc);
                const isDocStarred = doc._id in starredMap ? starredMap[doc._id] : doc.is_starred;
                return (
                  <div key={doc._id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <Link to={`/documents/${doc._id}`} className="group">
                            <p className="font-semibold text-primary group-hover:underline truncate">
                              {highlight(doc.title, q)}
                            </p>
                          </Link>

                          {doc.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {highlight(doc.description, q)}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                            {doc.dept_id && (
                              <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                                🏢 {highlight(doc.dept_id.name, q)}
                              </span>
                            )}
                            {doc.type_id && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                                🗂️ {highlight(doc.type_id.name, q)}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">ปีงบ {doc.fiscal_year}</span>
                            <span className="text-xs text-gray-400">{formatDate(doc.createdAt)}</span>
                            {doc.views > 0 && <span className="text-xs text-gray-400">👁 {doc.views}</span>}
                          </div>

                          {doc.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {doc.tags.map((tag, i) => (
                                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {highlight(tag, q)}
                                </span>
                              ))}
                            </div>
                          )}

                          {matched.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {matched.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded px-2 py-1">
                                  <span>📎</span>
                                  <span>{highlight(a.sub_title, q)}</span>
                                  {a.file_size && <span className="text-gray-400">· {formatSize(a.file_size)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right col */}
                        <div className="shrink-0 flex flex-col items-center gap-2">
                          <button
                            onClick={(e) => { e.preventDefault(); handleToggleStar(doc._id, isDocStarred); }}
                            title={isDocStarred ? 'ยกเลิกติดดาว' : 'ติดดาว'}
                            className={`text-xl transition ${isDocStarred ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                          >★</button>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
                            <p className="text-lg font-bold text-gray-700">{doc.attachments?.length || 0}</p>
                            <p className="text-xs text-gray-400">ไฟล์</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >← ก่อนหน้า</button>
              <span className="text-sm text-gray-600 px-3">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >ถัดไป →</button>
            </div>
          )}
        </>
      )}

      {!searched && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-5xl mb-3">🗂️</p>
          <p className="text-gray-500 font-medium">พิมพ์คำค้นหาเพื่อเริ่มต้น</p>
          <p className="text-sm text-gray-400 mt-1">ค้นหาได้จากชื่อเอกสาร, คำอธิบาย, ชื่อไฟล์, แท็ก, หน่วยงาน หรือประเภทเอกสาร</p>
        </div>
      )}
    </div>
  );
}

