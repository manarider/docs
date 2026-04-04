import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function getFiscalYearTH() {
  const now = new Date();
  const m = now.getMonth() + 1;
  return (now.getFullYear() + 543) + (m >= 10 ? 1 : 0);
}

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-6 text-white shadow">
        <h1 className="text-2xl font-bold">
          ยินดีต้อนรับ, {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-orange-100 mt-1">
          ระบบบริหารจัดการคลังเอกสาร
        </p>
        <div className="mt-3 flex gap-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full">
            ปีงบประมาณ {getFiscalYearTH()}
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'อัปโหลดเอกสาร', icon: '📤', to: '/documents/new', color: 'bg-orange-50 border-orange-200' },
          { label: 'ค้นหาเอกสาร', icon: '🔍', to: '/search', color: 'bg-blue-50 border-blue-200' },
          { label: 'เอกสารล่าสุด', icon: '📋', to: '/documents', color: 'bg-green-50 border-green-200' },
          { label: 'รายงาน', icon: '📊', to: '/reports', color: 'bg-purple-50 border-purple-200' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`border rounded-xl p-4 text-center hover:shadow-md transition ${item.color}`}
          >
            <div className="text-3xl mb-2">{item.icon}</div>
            <p className="text-sm font-medium text-gray-700">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
