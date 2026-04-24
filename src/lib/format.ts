/**
 * Format currency in Indian Rupees
 */
export const formatINR = (amount: number | null | undefined): string => {
  if (amount == null) return "₹0";
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

/**
 * Format a date for display
 */
export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

export const timeAgo = (date: string | Date): string => {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(d);
};

export const initials = (name: string | null | undefined): string => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((n) => n[0]).join("").toUpperCase();
};
