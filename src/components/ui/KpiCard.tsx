import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: "green" | "red" | "blue" | "orange";
  subtitle?: string;
  variant?: "default" | "gradient";
}

const badgeClasses = {
  green: "text-emerald-600 bg-emerald-50",
  red: "text-destructive bg-error-container",
  blue: "text-primary bg-primary-container",
  orange: "text-amber-600 bg-amber-50",
};

const iconBgClasses = {
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-error-container text-error-container-foreground",
  blue: "bg-primary-container text-primary-container-foreground",
  orange: "bg-amber-50 text-amber-600",
};

const KpiCard = ({
  label,
  value,
  icon: Icon,
  badge,
  badgeColor = "blue",
  subtitle,
  variant = "default",
}: KpiCardProps) => {
  if (variant === "gradient") {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl p-6 shadow-lg text-white">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
            <Icon className="w-5 h-5" />
          </div>
          {badge && (
            <span className="text-[10px] font-bold text-white/80">{badge}</span>
          )}
        </div>
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-white/70">{label}</p>
        <h3 className="text-2xl font-black tracking-tight mt-1">{value}</h3>
        {subtitle && <p className="text-[10px] text-white/60 mt-1">{subtitle}</p>}
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-outline/20">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${iconBgClasses[badgeColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badgeClasses[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-[10px] uppercase tracking-[0.15em] font-bold">{label}</p>
      <h3 className="text-2xl font-black text-on-surface tracking-tight mt-1">{value}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
};

export default KpiCard;
