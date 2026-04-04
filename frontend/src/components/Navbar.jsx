import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [qs, setQs] = useState('');

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (!qs.trim()) return;
    navigate(`/search?q=${encodeURIComponent(qs.trim())}`);
    setQs('');
  };

  return (
    <nav className="bg-primary shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-primary font-bold text-lg">ท</span>
          </div>
          <div className="text-white hidden sm:block">
            <p className="font-bold text-sm leading-tight">เทศบาลนครนครสวรรค์</p>
            <p className="text-xs text-orange-100">ระบบบริหารจัดการคลังเอกสาร</p>
          </div>
        </div>

        {/* Quick Search */}
        {user && (
          <form onSubmit={handleQuickSearch} className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">🔍</span>
              <input
                type="text"
                value={qs}
                onChange={(e) => setQs(e.target.value)}
                className="w-full bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:bg-white/30 transition"
                placeholder="ค้นหาเอกสาร..."
              />
            </div>
          </form>
        )}

        {/* User info */}
        {user && (
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            <div className="text-white text-sm text-right hidden sm:block">
              <p className="font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-orange-100 text-xs">{user.role} • {user.subDepartment || 'ทั่วไป'}</p>
            </div>
            <button
              onClick={logout}
              className="bg-white text-primary px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-50 transition"
            >
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

