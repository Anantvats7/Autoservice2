import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  Package,
  Users,
  UserCog,
  BarChart3,
  Plus,
  LogOut,
  Settings,
  HelpCircle,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Bookings", icon: Wrench, path: "/bookings" },
  { label: "Services", icon: Settings, path: "/services" },
  { label: "Inventory", icon: Package, path: "/inventory" },
  { label: "Employees", icon: UserCog, path: "/employees" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="h-screen w-64 border-r border-border/50 bg-surface-container-low fixed left-0 top-0 z-40 flex flex-col py-4">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-4 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-slate-600 rounded-lg flex items-center justify-center shadow-lg">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-on-surface font-bold text-sm tracking-tight">AutoServe</h2>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Manager Portal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-surface-container-high/50 hover:text-on-surface"
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-4 mt-auto pt-4 border-t border-border/50 space-y-1">
        <Link
          to="/bookings"
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-xl shadow-lg text-sm font-semibold hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>New Service Order</span>
        </Link>
        <button className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-on-surface text-[12px] font-medium w-full mt-2">
          <HelpCircle className="w-4 h-4" />
          <span>Support</span>
        </button>
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 text-destructive hover:opacity-80 text-[12px] font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
