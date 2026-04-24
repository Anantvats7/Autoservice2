import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Wrench, Package, Users, UserCog, BarChart3,
  LogOut, ClipboardList, Car, Calendar, History,
  X, Bot, DollarSign, ScanLine,
} from "lucide-react";
import AutoServeLogo from "@/components/AutoServeLogo";
import type { UserRole } from "./RoleLayout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// signOut handled inside component below

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const managerNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/manager/dashboard" },
  { label: "Bookings", icon: ClipboardList, path: "/manager/bookings" },
  { label: "Scan Hand-off", icon: ScanLine, path: "/manager/scan" },
  { label: "Service History", icon: History, path: "/manager/history" },
  { label: "Services", icon: Wrench, path: "/manager/services" },
  { label: "Inventory", icon: Package, path: "/manager/inventory" },
  { label: "Employees", icon: UserCog, path: "/manager/employees" },
  { label: "Customers", icon: Users, path: "/manager/customers" },
  { label: "Reports", icon: BarChart3, path: "/manager/reports" },
];

const employeeNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
  { label: "Service Queue", icon: Wrench, path: "/employee/queue" },
  { label: "Scan Hand-off", icon: ScanLine, path: "/employee/scan" },
  { label: "Inventory", icon: Package, path: "/employee/inventory" },
  { label: "Performance", icon: BarChart3, path: "/employee/performance" },
];

const customerNav: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, path: "/customer/dashboard" },
  { label: "My Vehicles", icon: Car, path: "/customer/vehicles" },
  { label: "Book Service", icon: Calendar, path: "/customer/book" },
  { label: "My Bookings", icon: ClipboardList, path: "/customer/bookings" },
  { label: "Service History", icon: History, path: "/customer/history" },
  { label: "AI Diagnostics", icon: Bot, path: "/customer/diagnostics" },
  { label: "Valuation", icon: DollarSign, path: "/customer/valuation" },
];

const navMap: Record<UserRole, NavItem[]> = {
  manager: managerNav,
  employee: employeeNav,
  customer: customerNav,
};

const subtitleMap: Record<UserRole, string> = {
  manager: "Manager Portal",
  employee: "Technician Portal",
  customer: "Customer Portal",
};

interface RoleSidebarProps {
  role: UserRole;
  onClose: () => void;
}

const RoleSidebar = ({ role, onClose }: RoleSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const navItems = navMap[role];

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  return (
    <aside className="h-screen w-64 border-r border-border/50 bg-surface-container-low flex flex-col py-4">
      {/* Brand */}
      <div className="flex items-center justify-between px-6 py-4 mb-2">
        <AutoServeLogo subtitle={subtitleMap[role]} />
        <button onClick={onClose} className="lg:hidden p-1 text-muted-foreground hover:text-on-surface transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-card text-primary shadow-sm border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-surface-container-high/50 hover:text-on-surface"
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-150 ${isActive ? "" : "group-hover:scale-110"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-4 mt-auto pt-4 border-t border-border/50 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-destructive hover:opacity-80 text-[12px] font-medium transition-opacity"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default RoleSidebar;
