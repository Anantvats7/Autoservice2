interface StatusBadgeProps {
  status: "in-progress" | "pending" | "completed" | "cancelled" | "approved" | "active" | "inactive" | "premium" | "flagged" | "optimal" | "low-stock" | "critical";
}

const statusConfig: Record<string, { bg: string; text: string; dot?: boolean }> = {
  "in-progress": { bg: "bg-blue-50", text: "text-blue-600", dot: true },
  pending: { bg: "bg-primary-container", text: "text-primary-container-foreground", dot: true },
  completed: { bg: "bg-emerald-50", text: "text-emerald-600" },
  cancelled: { bg: "bg-error-container", text: "text-error-container-foreground" },
  approved: { bg: "bg-surface-container-high", text: "text-on-surface" },
  active: { bg: "bg-emerald-50", text: "text-emerald-600", dot: true },
  inactive: { bg: "bg-surface-container", text: "text-muted-foreground" },
  premium: { bg: "bg-primary-container", text: "text-primary", dot: true },
  flagged: { bg: "bg-error-container", text: "text-destructive" },
  optimal: { bg: "bg-emerald-100", text: "text-emerald-700" },
  "low-stock": { bg: "bg-amber-100", text: "text-amber-700" },
  critical: { bg: "bg-destructive", text: "text-white" },
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig["pending"];
  const label = status
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
      {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.text.replace("text-", "bg-")} animate-pulse`} />}
      {label}
    </span>
  );
};

export default StatusBadge;
