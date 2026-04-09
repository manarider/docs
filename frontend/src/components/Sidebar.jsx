import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/documents', label: 'เอกสาร', icon: '📄' },
  { to: '/search', label: 'ค้นหา', icon: '🔍' },
  { to: '/reports', label: 'สถิติ', icon: '📊' },
];

const adminItems = [
  { to: '/admin/audit', label: 'Audit Log', icon: '🔒' },
  { to: '/admin/trash', label: 'เอกสารที่ถูกลบ', icon: '🗑️' },
  { to: '/admin/settings', label: 'ตั้งค่าระบบ', icon: '⚙️' },
];

const ROLE_LEVEL = { superadmin: 50, admin: 40, manager: 30, member: 20, viewer: 10 };

function NavItem({ to, icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition ${
          isActive
            ? 'bg-primary text-white font-medium'
            : 'text-gray-700 hover:bg-orange-50 hover:text-primary'
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const userLevel = ROLE_LEVEL[user?.role] || 0;
  const isAdmin = userLevel >= ROLE_LEVEL.admin;

  const sidebarContent = (
    <>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} end={item.to === '/'} onClick={onClose} />
        ))}

        {isAdmin && (
          <>
            <hr className="my-3 border-gray-100" />
            <p className="text-xs text-gray-400 px-3 mb-2 font-medium uppercase tracking-wider">จัดการ</p>
            {adminItems.map((item) => (
              <NavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          © 2026 งานจัดทำและพัฒนาระบบข้อมูลสารสนเทศ<br />
          กลุ่มงานสถิติข้อมูลและสารสนเทศ<br />
          เทศบาลนครนครสวรรค์ by manarider
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex flex-col w-56 min-h-full bg-white border-r border-gray-200 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer — slides in from left */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header with close button */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary">
          <p className="text-white font-semibold text-sm">เมนู</p>
          <button
            onClick={onClose}
            className="text-white p-1 rounded hover:bg-white/20 transition"
            aria-label="ปิดเมนู"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
