import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/documents', label: 'เอกสาร', icon: '📄' },
  { to: '/search', label: 'ค้นหา', icon: '🔍' },
  { to: '/reports', label: 'สถิติ', icon: '📊' },
];

const adminItems = [
  { to: '/admin/departments', label: 'หน่วยงาน', icon: '🏢' },
  { to: '/admin/doctypes', label: 'ประเภทเอกสาร', icon: '🗂️' },
  { to: '/admin/audit', label: 'Audit Log', icon: '🔒' },
  { to: '/admin/trash', label: 'เอกสารที่ถูกลบ', icon: '🗑️' },
  { to: '/admin/settings', label: 'ตั้งค่าระบบ', icon: '⚙️' },
];

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, member: 20, viewer: 10 };

export default function Sidebar() {
  const { user } = useAuth();
  const userLevel = ROLE_LEVEL[user?.role] || 0;
  const isAdmin = userLevel >= ROLE_LEVEL.admin;

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                isActive
                  ? 'bg-primary text-white font-medium'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-primary'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <hr className="my-3 border-gray-100" />
            <p className="text-xs text-gray-400 px-3 mb-2 font-medium uppercase tracking-wider">จัดการ</p>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    isActive
                      ? 'bg-primary text-white font-medium'
                      : 'text-gray-700 hover:bg-orange-50 hover:text-primary'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          © 2026 งานจัดทำและพัฒนาระบบข้อมูลสารสนเทศ<br />
          กลุ่มงานสถิติข้อมูลและสารสนเทศ<br />
          เทศบาลนครนครสวรรค์
        </p>
      </div>
    </aside>
  );
}
