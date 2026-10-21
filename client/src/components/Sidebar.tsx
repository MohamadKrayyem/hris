import { BarChart3, Briefcase, LogOut, Users, type LucideIcon } from "lucide-react";

// The pages the app can show
export type Page = "employees" | "reports";

type Props = { activePage: Page; onChange: (page: Page) => void; userName: string; onLogout: () => void };

const menu: { page: Page; label: string; icon: LucideIcon }[] = [
  { page: "employees", label: "Employees", icon: Users },
  { page: "reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar({ activePage, onChange, userName, onLogout }: Props) {
  // "Fatima Al-Sayed" -> "FA"
  const initials = userName.split(" ").filter(Boolean).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="logo">
        <Briefcase size={22} /> HRIS
      </div>

      <nav className="menu">
        {menu.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            // Highlight the item for the page we are on
            className={page === activePage ? "menu-item active" : "menu-item"}
            onClick={() => onChange(page)}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <div className="user">
        <div className="avatar">{initials}</div>
        <div>
          <p className="user-name">{userName}</p>
          <p className="user-role">HR Manager</p>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        <LogOut size={16} /> Logout
      </button>
    </aside>
  );
}
